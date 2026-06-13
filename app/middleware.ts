import { NextResponse, type NextRequest } from "next/server";

// Middleware は Edge ランタイムで動作するため、Node 固有のモジュールを読み込めません。
// ここでは Node ランタイムの API Route (`/api/session`) を呼び出してセッションを更新します。

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const sessionUrl = new URL("/api/session", url);

  // リクエストの Cookie を API にフォワードする
  const cookieHeader = req.headers.get("cookie") ?? "";

  try {
    const apiRes = await fetch(sessionUrl.toString(), {
      method: "GET",
      headers: {
        cookie: cookieHeader,
      },
    });

    // レスポンス本体を読み取り、必要なら後続リクエストに情報を渡す
    const json = await apiRes.json().catch(() => null);

    const response = NextResponse.next({ request: req });

    // API が Set-Cookie を返した場合は、可能ならそれをそのままクライアントに渡す
    const setCookie = apiRes.headers.get("set-cookie");
    if (setCookie) {
      response.headers.set("set-cookie", setCookie);
    }

    // 任意: ユーザー情報を downstream に伝えたい場合はヘッダを付与（小さくしておく）
    if (json && json.user) {
      const minimal = {
        id: json.user.id ?? null,
        email: json.user.email ?? null,
      };
      response.headers.set("x-supabase-user", JSON.stringify(minimal));
    }

    return response;
  } catch (err) {
    // API 呼び出しに失敗してもリクエスト自体は継続させる
    return NextResponse.next({ request: req });
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};
