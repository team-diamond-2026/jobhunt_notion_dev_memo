import { redirect } from 'next/navigation'
import { getCurrentUser } from './auth'

/**
 * 認証が必要なページ用の保護ユーティリティ
 * サーバーコンポーネント内で使用
 */
export async function requireAuth() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/login')
  }
  
  return user
}
