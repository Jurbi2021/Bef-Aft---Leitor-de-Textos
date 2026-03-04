import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

/** Só deve ser chamado uma vez no app (ex.: AuthInitializer). Evita loop de requests. */
export function useAuthInit() {
  const { setUser, setProfile, setLoading, reset } = useAuthStore()

  useEffect(() => {
    let cancelled = false
    const timeout = setTimeout(() => {
      if (cancelled) return
      setLoading(false)
    }, 8000)

    async function fetchProfile(userId: string, userEmail?: string, userName?: string) {
      setLoading(true)
      try {
        let { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()

        if (!data) {
          await supabase.from('profiles').insert({
            id: userId,
            role: 'client',
            full_name: userName ?? userEmail ?? null,
          } as object)
          const { data: newProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()
          data = newProfile
        }

        setProfile(data ?? null)
      } catch {
        setProfile(null)
      } finally {
        setLoading(false)
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
      if (cancelled) return
      setUser(session?.user ?? null)
      if (session?.user) {
        const u = session.user
        fetchProfile(u.id, u.email, u.user_metadata?.full_name ?? u.user_metadata?.name)
      } else {
        setLoading(false)
      }
    }).catch(() => setLoading(false))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        const u = session.user
        fetchProfile(u.id, u.email, u.user_metadata?.full_name ?? u.user_metadata?.name)
      } else {
        reset()
      }
    })

    return () => {
      cancelled = true
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])
}

/** Leitura do estado de auth + signIn/signOut. Não dispara efeitos (sem loop). */
export function useAuth() {
  const { user, profile, loading, reset } = useAuthStore()

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    reset()
  }

  return { user, profile, loading, signIn, signOut }
}
