import { NextResponse, type NextRequest } from "next/server";

// Middleware は Edge ランタイムで動作するため、Node 固有のモジュールを読み込めません。
// ここでは Node ランタイムの API Route (`/api/session`) を呼び出してセッションを更新します。

export async function middleware(req: NextRequest) {
  try {
    // session API の絶対 URL を安全に構築（host があればそちらを使う）
    const host = req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const sessionUrl = host
      ? `${proto}://${host}/api/session`
      : new URL("/api/session", new URL(req.url)).toString();

    // リクエストの Cookie を API にフォワードする
    const cookieHeader = req.headers.get("cookie") ?? "";

    const apiRes = await fetch(sessionUrl, {
      method: "GET",
      headers: {
        cookie: cookieHeader,
      },
    });

    // レスポンス本体を読み取り、必要なら後続リクエストに情報を渡す
    const json = await apiRes.json().catch(() => null);

    const response = NextResponse.next({ request: req });

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
    // どこかで例外が発生してもリクエスト自体は継続させる
    return NextResponse.next({ request: req });
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\.|.*\\.svg).*)"],
};
