"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "../../lib/supabase/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isSignUp) {
        // サインアップ処理
        await signUp(email, password, displayName);
        setSuccessMessage(
          "サインアップに成功しました。メールを確認してください。",
        );
        setIsSignUp(false);
        setDisplayName("");
      } else {
        // ログイン処理
        await signIn(email, password);
        // ログイン成功後、ホームページにリダイレクト
        router.push("/");
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("エラーが発生しました");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50 py-6 px-4 sm:py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-2xl sm:text-3xl font-extrabold text-gray-900">
            {isSignUp ? "アカウント作成" : "ログイン"}
          </h2>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-base sm:text-sm font-medium text-red-800 [overflow-wrap:anywhere]">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="rounded-md bg-green-50 p-4">
            <p className="text-base sm:text-sm font-medium text-green-800 [overflow-wrap:anywhere]">
              {successMessage}
            </p>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {isSignUp && (
            <div>
              <label htmlFor="displayName" className="sr-only">
                表示名
              </label>
              <input
                id="displayName"
                type="text"
                autoComplete="nickname"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="表示名"
                className="appearance-none rounded-none relative block min-h-11 w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-base text-gray-900 rounded-t-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="sr-only">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="メールアドレス"
              required
              className={`appearance-none rounded-none relative block min-h-11 w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-base text-gray-900 ${
                isSignUp ? "rounded-none" : "rounded-t-md"
              } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`}
            />
          </div>

          <div>
            <label htmlFor="password" className="sr-only">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード"
              required
              className="appearance-none rounded-none relative block min-h-11 w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-base text-gray-900 rounded-b-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="group relative min-h-11 w-full flex items-center justify-center py-2 px-4 border border-transparent text-base sm:text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "処理中..." : isSignUp ? "アカウント作成" : "ログイン"}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="min-h-11 w-full rounded-md px-2 py-2 text-base sm:text-sm text-blue-600 hover:text-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {isSignUp ? "ログイン画面に戻る" : "アカウントを作成する"}
          </button>
        </form>
      </div>
    </div>
  );
}
