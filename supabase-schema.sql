-- ============================================================
-- Leitor Bef/Aft — Supabase Schema
-- Execute no SQL Editor do Supabase (supabase.com/dashboard)
-- ============================================================

-- 1. Tabela de perfis de usuários (extensão de auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  client_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Clientes
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referência de profiles → clients
ALTER TABLE profiles
  ADD CONSTRAINT profiles_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

-- 3. Pastas (pertencem a um cliente)
CREATE TABLE IF NOT EXISTS folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Páginas (pertencem a uma pasta)
CREATE TABLE IF NOT EXISTS pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Seções (pertencem a uma página)
CREATE TABLE IF NOT EXISTS sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content_before TEXT NOT NULL DEFAULT '',
  content_after TEXT NOT NULL DEFAULT '',
  defense_note TEXT NOT NULL DEFAULT '',
  "order" INTEGER NOT NULL DEFAULT 0,
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'approved_with_observations', 'rejected')),
  approval_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approval_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Mensagens do chat geral (por cliente)
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  mention_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Comentários por seção
CREATE TABLE IF NOT EXISTS section_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  mention_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_comments ENABLE ROW LEVEL SECURITY;

-- Helper: verifica se o usuário atual é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper: retorna o client_id do usuário atual
CREATE OR REPLACE FUNCTION current_client_id()
RETURNS UUID AS $$
  SELECT client_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Profiles: usuário vê o próprio; admin vê todos; cliente vê outros do mesmo cliente (para @ no chat)
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (id = auth.uid() OR is_admin() OR client_id = current_client_id());

CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (id = auth.uid() OR is_admin());

-- Clients: admin gerencia tudo; cliente vê apenas o seu
CREATE POLICY "clients_admin_all" ON clients FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "clients_client_select" ON clients FOR SELECT
  USING (id = current_client_id());

-- Folders: admin gerencia tudo; cliente vê apenas as suas
CREATE POLICY "folders_admin_all" ON folders FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "folders_client_select" ON folders FOR SELECT
  USING (client_id = current_client_id());

-- Pages: admin gerencia tudo; cliente vê páginas das suas pastas
CREATE POLICY "pages_admin_all" ON pages FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "pages_client_select" ON pages FOR SELECT
  USING (
    folder_id IN (
      SELECT id FROM folders WHERE client_id = current_client_id()
    )
  );

-- Sections: admin gerencia tudo; cliente vê seções das suas páginas
CREATE POLICY "sections_admin_all" ON sections FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "sections_client_select" ON sections FOR SELECT
  USING (
    page_id IN (
      SELECT p.id FROM pages p
      JOIN folders f ON f.id = p.folder_id
      WHERE f.client_id = current_client_id()
    )
  );

-- Chat messages: todos do cliente veem e escrevem no chat do seu client_id
CREATE POLICY "chat_messages_select" ON chat_messages FOR SELECT
  USING (client_id = current_client_id() OR is_admin());

CREATE POLICY "chat_messages_insert" ON chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    (client_id = current_client_id() OR is_admin())
  );

-- Section comments: todos do cliente veem e escrevem nos comentários das suas seções
CREATE POLICY "section_comments_select" ON section_comments FOR SELECT
  USING (
    section_id IN (
      SELECT s.id FROM sections s
      JOIN pages p ON p.id = s.page_id
      JOIN folders f ON f.id = p.folder_id
      WHERE f.client_id = current_client_id()
    )
    OR is_admin()
  );

CREATE POLICY "section_comments_insert" ON section_comments FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    (
      section_id IN (
        SELECT s.id FROM sections s
        JOIN pages p ON p.id = s.page_id
        JOIN folders f ON f.id = p.folder_id
        WHERE f.client_id = current_client_id()
      )
      OR is_admin()
    )
  );

-- ============================================================
-- RPC: Definir aprovação da seção (só cliente do mesmo cliente)
-- Status: approved | approved_with_observations | rejected
-- ============================================================

CREATE OR REPLACE FUNCTION set_section_approval(p_section_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_user_client_id UUID;
BEGIN
  p_status := LOWER(TRIM(p_status));
  IF p_status NOT IN ('approved', 'approved_with_observations', 'rejected') THEN
    RAISE EXCEPTION 'Status inválido. Use: approved, approved_with_observations ou rejected.';
  END IF;

  SELECT f.client_id INTO v_client_id
  FROM sections s
  JOIN pages p ON p.id = s.page_id
  JOIN folders f ON f.id = p.folder_id
  WHERE s.id = p_section_id;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Seção não encontrada.';
  END IF;

  v_user_client_id := current_client_id();

  IF v_user_client_id IS NULL OR v_user_client_id != v_client_id THEN
    IF NOT is_admin() THEN
      RAISE EXCEPTION 'Apenas o cliente desta seção pode definir aprovação.';
    END IF;
  END IF;

  UPDATE sections
  SET approval_status = p_status, approval_by = auth.uid(), approval_at = NOW(), updated_at = NOW()
  WHERE id = p_section_id;
END;
$$;

-- ============================================================
-- RPC: Vincular perfil de usuário a um cliente (só admin)
-- Usado pelo app em "Conceder acesso" > Vincular agora
-- ============================================================

CREATE OR REPLACE FUNCTION vincular_perfil_ao_cliente(
  p_user_id UUID,
  p_client_id UUID,
  p_full_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem vincular perfis a clientes.';
  END IF;

  INSERT INTO profiles (id, role, client_id, full_name)
  VALUES (p_user_id, 'client', p_client_id, COALESCE(p_full_name, ''))
  ON CONFLICT (id) DO UPDATE SET
    role = 'client',
    client_id = p_client_id,
    full_name = COALESCE(p_full_name, profiles.full_name);
END;
$$;

-- ============================================================
-- Perfil: criado pelo app no primeiro login (evita erro ao criar
-- usuário no Dashboard por causa de RLS no trigger).
-- ============================================================

-- Se você já rodou este schema antes e tinha o trigger, remova-o
-- para poder criar usuários pelo Dashboard (rode no SQL Editor):
--   DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--   DROP FUNCTION IF EXISTS handle_new_user();

-- ============================================================
-- Realtime: habilitar para chat e comentários
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE section_comments;

-- ============================================================
-- Migração: se você já rodou o schema antes, execute só o bloco
-- abaixo no SQL Editor para adicionar aprovação e menções:
-- ============================================================
-- ALTER TABLE sections ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'approved_with_observations', 'rejected'));
-- ALTER TABLE sections ADD COLUMN IF NOT EXISTS approval_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
-- ALTER TABLE sections ADD COLUMN IF NOT EXISTS approval_at TIMESTAMPTZ;
-- ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS mention_ids UUID[] DEFAULT '{}';
-- ALTER TABLE section_comments ADD COLUMN IF NOT EXISTS mention_ids UUID[] DEFAULT '{}';
-- (A função set_section_approval e a policy profiles_select já estão acima; se precisar recriar a policy, DROP POLICY "profiles_select" ON profiles; e depois crie de novo com OR client_id = current_client_id().)

-- ============================================================
-- Para criar seu usuário admin, após criar via Auth, execute:
-- UPDATE profiles SET role = 'admin' WHERE id = 'SEU_USER_ID';
-- ============================================================
