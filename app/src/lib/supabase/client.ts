import { createBrowserClient } from '@supabase/ssr'
 
export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      '環境変数 NEXT_PUBLIC_SUPABASE_URL または NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません。app/.env.local を確認してください。'
    )
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
