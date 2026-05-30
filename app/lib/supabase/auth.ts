import { createClient } from './client'

/**
 * ユーザーをサインアップする
 */
export async function signUp(email: string, password: string, displayName?: string) {
  const supabase = createClient()
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName || email,
      },
    },
  })
  
  if (error) throw error
  return data
}

/**
 * ユーザーをログインする
 */
export async function signIn(email: string, password: string) {
  const supabase = createClient()
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) throw error
  return data
}

/**
 * ユーザーをログアウトする
 */
export async function signOut() {
  const supabase = createClient()
  
  const { error } = await supabase.auth.signOut()
  
  if (error) throw error
}

/**
 * 現在のセッションユーザーを取得
 */
export async function getCurrentUser() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()
  
  return user
}

/**
 * 現在のセッションを取得
 */
export async function getSession() {
  const supabase = await createClient()
  
  const {
    data: { session },
  } = await supabase.auth.getSession()
  
  return session
}
