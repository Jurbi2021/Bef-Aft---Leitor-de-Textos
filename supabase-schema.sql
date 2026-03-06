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
  section_type TEXT NOT NULL DEFAULT 'content' CHECK (section_type IN ('content', 'serp_preview')),
  meta_title TEXT NOT NULL DEFAULT '',
  meta_description TEXT NOT NULL DEFAULT '',
  meta_url TEXT NOT NULL DEFAULT '',
  meta_approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (meta_approval_status IN ('pending', 'approved', 'approved_with_observations', 'rejected')),
  meta_approval_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  meta_approval_at TIMESTAMPTZ,
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

-- 8. Menções lidas (para notificações in-app)
CREATE TABLE IF NOT EXISTS mention_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('chat_message', 'section_comment')),
  source_id UUID NOT NULL,
  section_id UUID REFERENCES sections(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, source_type, source_id)
);

-- 9. Notificações de aprovação (admin é notificado quando cliente aprova/reprova)
CREATE TABLE IF NOT EXISTS approval_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  approval_type TEXT NOT NULL CHECK (approval_type IN ('content', 'meta')),
  approval_status TEXT NOT NULL CHECK (approval_status IN ('approved', 'approved_with_observations', 'rejected')),
  approved_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_name TEXT,
  client_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Leitura de notificações de aprovação (admin marca como lida)
CREATE TABLE IF NOT EXISTS approval_notification_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id UUID NOT NULL REFERENCES approval_notifications(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, notification_id)
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
ALTER TABLE mention_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_notification_reads ENABLE ROW LEVEL SECURITY;

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

-- Mention reads: usuário só vê e insere suas próprias linhas
CREATE POLICY "mention_reads_select" ON mention_reads FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "mention_reads_insert" ON mention_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Approval notifications: só admin pode ler (para notificações)
CREATE POLICY "approval_notifications_select" ON approval_notifications FOR SELECT
  USING (is_admin());

-- Approval notification reads: admin só vê e insere suas próprias
CREATE POLICY "approval_notification_reads_select" ON approval_notification_reads FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "approval_notification_reads_insert" ON approval_notification_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

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
  v_section_name TEXT;
  v_client_name TEXT;
  v_is_client BOOLEAN;
BEGIN
  p_status := LOWER(TRIM(p_status));
  IF p_status NOT IN ('approved', 'approved_with_observations', 'rejected') THEN
    RAISE EXCEPTION 'Status inválido. Use: approved, approved_with_observations ou rejected.';
  END IF;

  SELECT f.client_id, s.name, c.name INTO v_client_id, v_section_name, v_client_name
  FROM sections s
  JOIN pages p ON p.id = s.page_id
  JOIN folders f ON f.id = p.folder_id
  JOIN clients c ON c.id = f.client_id
  WHERE s.id = p_section_id;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Seção não encontrada.';
  END IF;

  v_user_client_id := current_client_id();
  v_is_client := (v_user_client_id IS NOT NULL AND v_user_client_id = v_client_id);

  IF NOT v_is_client AND NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas o cliente desta seção pode definir aprovação.';
  END IF;

  UPDATE sections
  SET approval_status = p_status, approval_by = auth.uid(), approval_at = NOW(), updated_at = NOW()
  WHERE id = p_section_id;

  -- Notificar admin quando cliente aprova/reprova
  IF v_is_client THEN
    INSERT INTO approval_notifications (section_id, client_id, approval_type, approval_status, approved_by, section_name, client_name)
    VALUES (p_section_id, v_client_id, 'content', p_status, auth.uid(), v_section_name, v_client_name);
  END IF;
END;
$$;

-- ============================================================
-- RPC: Definir aprovação dos Meta tags da seção (só cliente)
-- Status: approved | approved_with_observations | rejected
-- ============================================================

CREATE OR REPLACE FUNCTION set_meta_approval(p_section_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_user_client_id UUID;
  v_section_name TEXT;
  v_client_name TEXT;
  v_is_client BOOLEAN;
BEGIN
  p_status := LOWER(TRIM(p_status));
  IF p_status NOT IN ('approved', 'approved_with_observations', 'rejected') THEN
    RAISE EXCEPTION 'Status inválido. Use: approved, approved_with_observations ou rejected.';
  END IF;

  SELECT f.client_id, s.name, c.name INTO v_client_id, v_section_name, v_client_name
  FROM sections s
  JOIN pages p ON p.id = s.page_id
  JOIN folders f ON f.id = p.folder_id
  JOIN clients c ON c.id = f.client_id
  WHERE s.id = p_section_id;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Seção não encontrada.';
  END IF;

  v_user_client_id := current_client_id();
  v_is_client := (v_user_client_id IS NOT NULL AND v_user_client_id = v_client_id);

  IF NOT v_is_client AND NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas o cliente desta seção pode definir aprovação dos meta tags.';
  END IF;

  UPDATE sections
  SET meta_approval_status = p_status, meta_approval_by = auth.uid(), meta_approval_at = NOW(), updated_at = NOW()
  WHERE id = p_section_id;

  -- Notificar admin quando cliente aprova/reprova meta tags
  IF v_is_client THEN
    INSERT INTO approval_notifications (section_id, client_id, approval_type, approval_status, approved_by, section_name, client_name)
    VALUES (p_section_id, v_client_id, 'meta', p_status, auth.uid(), v_section_name, v_client_name);
  END IF;
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
-- abaixo no SQL Editor para adicionar colunas novas:
-- ============================================================
-- Aprovação de conteúdo e menções (versão anterior):
ALTER TABLE sections ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'approved_with_observations', 'rejected'));
ALTER TABLE sections ADD COLUMN IF NOT EXISTS approval_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE sections ADD COLUMN IF NOT EXISTS approval_at TIMESTAMPTZ;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS mention_ids UUID[] DEFAULT '{}';
ALTER TABLE section_comments ADD COLUMN IF NOT EXISTS mention_ids UUID[] DEFAULT '{}';
-- Tipo de seção e campos SERP Preview (esta versão):
ALTER TABLE sections ADD COLUMN IF NOT EXISTS section_type TEXT NOT NULL DEFAULT 'content' CHECK (section_type IN ('content', 'serp_preview'));
ALTER TABLE sections ADD COLUMN IF NOT EXISTS meta_title TEXT NOT NULL DEFAULT '';
ALTER TABLE sections ADD COLUMN IF NOT EXISTS meta_description TEXT NOT NULL DEFAULT '';
ALTER TABLE sections ADD COLUMN IF NOT EXISTS meta_url TEXT NOT NULL DEFAULT '';
ALTER TABLE sections ADD COLUMN IF NOT EXISTS meta_approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (meta_approval_status IN ('pending', 'approved', 'approved_with_observations', 'rejected'));
ALTER TABLE sections ADD COLUMN IF NOT EXISTS meta_approval_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE sections ADD COLUMN IF NOT EXISTS meta_approval_at TIMESTAMPTZ;
-- Tabela mention_reads (notificações in-app):
CREATE TABLE IF NOT EXISTS mention_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('chat_message', 'section_comment')),
  source_id UUID NOT NULL,
  section_id UUID REFERENCES sections(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, source_type, source_id)
);
ALTER TABLE mention_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mention_reads_select" ON mention_reads;
CREATE POLICY "mention_reads_select" ON mention_reads FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "mention_reads_insert" ON mention_reads;
CREATE POLICY "mention_reads_insert" ON mention_reads FOR INSERT WITH CHECK (user_id = auth.uid());
-- Tabelas de notificação de aprovação (admin notificado quando cliente aprova/reprova):
CREATE TABLE IF NOT EXISTS approval_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  approval_type TEXT NOT NULL CHECK (approval_type IN ('content', 'meta')),
  approval_status TEXT NOT NULL CHECK (approval_status IN ('approved', 'approved_with_observations', 'rejected')),
  approved_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_name TEXT,
  client_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS approval_notification_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id UUID NOT NULL REFERENCES approval_notifications(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, notification_id)
);
ALTER TABLE approval_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_notification_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "approval_notifications_select" ON approval_notifications;
CREATE POLICY "approval_notifications_select" ON approval_notifications FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS "approval_notification_reads_select" ON approval_notification_reads;
CREATE POLICY "approval_notification_reads_select" ON approval_notification_reads FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "approval_notification_reads_insert" ON approval_notification_reads;
CREATE POLICY "approval_notification_reads_insert" ON approval_notification_reads FOR INSERT WITH CHECK (user_id = auth.uid());
-- Recriar RPCs para inserir em approval_notifications quando cliente aprova:
CREATE OR REPLACE FUNCTION set_section_approval(p_section_id UUID, p_status TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_client_id UUID; v_user_client_id UUID; v_section_name TEXT; v_client_name TEXT; v_is_client BOOLEAN;
BEGIN
  p_status := LOWER(TRIM(p_status));
  IF p_status NOT IN ('approved', 'approved_with_observations', 'rejected') THEN RAISE EXCEPTION 'Status inválido.'; END IF;
  SELECT f.client_id, s.name, c.name INTO v_client_id, v_section_name, v_client_name
  FROM sections s JOIN pages p ON p.id = s.page_id JOIN folders f ON f.id = p.folder_id JOIN clients c ON c.id = f.client_id
  WHERE s.id = p_section_id;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Seção não encontrada.'; END IF;
  v_user_client_id := current_client_id();
  v_is_client := (v_user_client_id IS NOT NULL AND v_user_client_id = v_client_id);
  IF NOT v_is_client AND NOT is_admin() THEN RAISE EXCEPTION 'Apenas o cliente desta seção pode definir aprovação.'; END IF;
  UPDATE sections SET approval_status = p_status, approval_by = auth.uid(), approval_at = NOW(), updated_at = NOW() WHERE id = p_section_id;
  IF v_is_client THEN
    INSERT INTO approval_notifications (section_id, client_id, approval_type, approval_status, approved_by, section_name, client_name)
    VALUES (p_section_id, v_client_id, 'content', p_status, auth.uid(), v_section_name, v_client_name);
  END IF;
END; $$;
CREATE OR REPLACE FUNCTION set_meta_approval(p_section_id UUID, p_status TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_client_id UUID; v_user_client_id UUID; v_section_name TEXT; v_client_name TEXT; v_is_client BOOLEAN;
BEGIN
  p_status := LOWER(TRIM(p_status));
  IF p_status NOT IN ('approved', 'approved_with_observations', 'rejected') THEN RAISE EXCEPTION 'Status inválido.'; END IF;
  SELECT f.client_id, s.name, c.name INTO v_client_id, v_section_name, v_client_name
  FROM sections s JOIN pages p ON p.id = s.page_id JOIN folders f ON f.id = p.folder_id JOIN clients c ON c.id = f.client_id
  WHERE s.id = p_section_id;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Seção não encontrada.'; END IF;
  v_user_client_id := current_client_id();
  v_is_client := (v_user_client_id IS NOT NULL AND v_user_client_id = v_client_id);
  IF NOT v_is_client AND NOT is_admin() THEN RAISE EXCEPTION 'Apenas o cliente desta seção pode definir aprovação dos meta tags.'; END IF;
  UPDATE sections SET meta_approval_status = p_status, meta_approval_by = auth.uid(), meta_approval_at = NOW(), updated_at = NOW() WHERE id = p_section_id;
  IF v_is_client THEN
    INSERT INTO approval_notifications (section_id, client_id, approval_type, approval_status, approved_by, section_name, client_name)
    VALUES (p_section_id, v_client_id, 'meta', p_status, auth.uid(), v_section_name, v_client_name);
  END IF;
END; $$;

-- ============================================================
-- Para criar seu usuário admin, após criar via Auth, execute:
-- UPDATE profiles SET role = 'admin' WHERE id = 'SEU_USER_ID';
-- ============================================================
