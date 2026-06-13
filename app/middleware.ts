import { NextResponse, type NextRequest } from "next/server";

// Middleware は Edge ランタイムで動作するため、
// Node 固有のモジュール（例: `@supabase/ssr`）を直接読み込むとランタイムエラーになります。
// ここではミドルウェア中で直接 Supabase サーバークライアントを呼ばず、
// 必要なら別のサーバーサイド Route（Node ランタイム）へ委譲してください。

export async function middleware(req: NextRequest) {
  // ここでは簡易に次へ進めるだけにします（edge-safe）。
  // 認証チェック等が必要なら API Route を用意して fetch してください。
  return NextResponse.next({ request: req });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};
