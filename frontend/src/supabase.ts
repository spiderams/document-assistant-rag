import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !key) {
  throw new Error('VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définis dans frontend/.env.local')
}

// Clé publique (publishable) uniquement : les tables sont protégées par RLS côté Supabase,
// et toutes les données passent par FastAPI, qui vérifie le jeton et le rôle.
export const supabase = createClient(url, key)
