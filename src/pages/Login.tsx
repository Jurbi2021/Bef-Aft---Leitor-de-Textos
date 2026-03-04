import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { AlignLeft, Eye, EyeOff, Loader2 } from 'lucide-react'
import { loginSchema, type LoginFormData } from '@/lib/zod-schemas'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'

export function Login() {
  const { signIn } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginFormData) {
    setAuthError(null)
    const { error } = await signIn(data.email, data.password)
    if (error) {
      setAuthError('Email ou senha incorretos.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-950 via-violet-900 to-violet-800 p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 overflow-hidden">
            <img src="/leitor_bef_aft_logo.webp" alt="Leitor Bef/Aft" className="h-10 w-10 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.nextElementSibling; if (fb) (fb as HTMLElement).classList.remove('hidden'); }} />
            <span className="hidden absolute inset-0 items-center justify-center"><AlignLeft className="h-6 w-6 text-white" /></span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">Leitor Bef/Aft</h1>
            <p className="mt-1 text-sm text-white/60">Comparador de textos otimizados</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 shadow-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/70">Email</label>
              <Input
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-violet-400"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/70">Senha</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-violet-400 pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            {authError && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400"
              >
                {authError}
              </motion.p>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-violet-500 hover:bg-violet-400 text-white"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
