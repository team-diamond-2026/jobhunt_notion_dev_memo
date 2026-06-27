"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  requestPasswordReset,
  signIn,
  signUp,
} from "../../lib/supabase/auth";

type AuthMode = "login" | "signup" | "reset";

function getFriendlyError(error: unknown) {
  if (!(error instanceof Error)) {
    return "エラーが発生しました。時間をおいてもう一度お試しください。";
  }

  const message = error.message;

  if (message.includes("rate limit") || message.includes("too many")) {
    return "短時間に何度も送信されています。少し待ってからもう一度お試しください。";
  }

  if (message.includes("Email not confirmed")) {
    return "メールアドレスの確認が完了していません。確認メールをご確認ください。";
  }

  if (message.includes("Invalid login credentials")) {
    return "メールアドレスまたはパスワードが正しくありません。";
  }

  if (message.includes("User already registered")) {
    return "このメールアドレスはすでに登録されています。";
  }

  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [signUpCooldown, setSignUpCooldown] = useState(0);
  const signUpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSignUp = mode === "signup";
  const isReset = mode === "reset";

  useEffect(() => {
    if (signUpCooldown > 0) {
      signUpTimeoutRef.current = setTimeout(() => {
        setSignUpCooldown((current) => current - 1);
      }, 1000);
    }

    return () => {
      if (signUpTimeoutRef.current) {
        clearTimeout(signUpTimeoutRef.current);
      }
    };
  }, [signUpCooldown]);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isReset) {
        const redirectTo = `${window.location.origin}/reset-password`;
        await requestPasswordReset(email, redirectTo);
        setSuccessMessage(
          "パスワード再設定メールを送信しました。メール内のリンクから新しいパスワードを設定してください。",
        );
        setPassword("");
        return;
      }

      if (isSignUp) {
        if (signUpCooldown > 0) {
          setError(
            `アカウント作成は ${signUpCooldown} 秒後にもう一度お試しください。`,
          );
          return;
        }

        await signUp(email, password, displayName);
        setSuccessMessage(
          "アカウントを作成しました。確認メールを送信したので、メール内のリンクを開いてからログインしてください。",
        );
        setMode("login");
        setDisplayName("");
        setEmail("");
        setPassword("");
        setSignUpCooldown(60);
        return;
      }

      await signIn(email, password);
      router.push("/");
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const title = isReset
    ? "パスワード再設定"
    : isSignUp
      ? "アカウント作成"
      : "ログイン";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-md items-center">
        <section className="w-full space-y-8">
          <header className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
            <p className="mt-3 text-sm text-gray-600">
              {isReset
                ? "登録済みのメールアドレスに再設定リンクを送ります。"
                : "Shukatsu OS にアクセスするには認証してください。"}
            </p>
          </header>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="rounded-md bg-green-50 p-4">
              <p className="text-sm font-medium text-green-800">
                {successMessage}
              </p>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {isSignUp && (
              <div>
                <label
                  htmlFor="displayName"
                  className="block text-sm font-medium text-gray-700"
                >
                  表示名
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="山田 太郎"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            {!isReset && (
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  パスワード
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="6文字以上"
                  minLength={6}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || (isSignUp && signUpCooldown > 0)}
              className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading
                ? "処理中..."
                : isReset
                  ? "再設定メールを送信"
                  : isSignUp
                    ? signUpCooldown > 0
                      ? `${signUpCooldown}秒後に再試行`
                      : "アカウント作成"
                    : "ログイン"}
            </button>
          </form>

          <div className="space-y-3 text-center text-sm">
            {!isReset && (
              <button
                type="button"
                onClick={() => switchMode("reset")}
                className="text-blue-600 hover:text-blue-500"
              >
                パスワードを忘れた方
              </button>
            )}

            <div>
              {isSignUp ? (
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="text-blue-600 hover:text-blue-500"
                >
                  ログイン画面に戻る
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="text-blue-600 hover:text-blue-500"
                >
                  アカウントを作成する
                </button>
              )}
            </div>

            {isReset && (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-blue-600 hover:text-blue-500"
              >
                ログイン画面に戻る
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
