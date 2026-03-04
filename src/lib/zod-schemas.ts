import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo de 6 caracteres'),
})

export type LoginFormData = z.infer<typeof loginSchema>

export const clientSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
})

export type ClientFormData = z.infer<typeof clientSchema>

export const folderSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
})

export type FolderFormData = z.infer<typeof folderSchema>

export const pageSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
})

export type PageFormData = z.infer<typeof pageSchema>

export const sectionSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
})

export type SectionFormData = z.infer<typeof sectionSchema>
