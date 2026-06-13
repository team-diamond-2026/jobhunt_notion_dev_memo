"use client";

import { useState, useEffect, useRef } from "react";
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
  const [signUpCooldown, setSignUpCooldown] = useState(0);
  const signUpTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // クールダウンタイマー
  useEffect(() => {
    if (signUpCooldown > 0) {
      signUpTimeoutRef.current = setTimeout(() => {
        setSignUpCooldown(signUpCooldown - 1);
      }, 1000);
    }
    return () => {
      if (signUpTimeoutRef.current) clearTimeout(signUpTimeoutRef.current);
    };
  }, [signUpCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isSignUp) {
        // クールダウン中かチェック
        if (signUpCooldown > 0) {
          setError(`サインアップは ${signUpCooldown} 秒後に再度お試しください。`);
          setIsLoading(false);
          return;
        }

        // サインアップ処理
        await signUp(email, password, displayName);
        setSuccessMessage(
          "アカウント作成に成功しました。確認メールを送信しましたので、メール内のリンクをクリックして確認してください。確認後にログインできます。",
        );
        setIsSignUp(false);
        setDisplayName("");
        setEmail("");
        setPassword("");
        
        // 60秒のクールダウンを設定
        setSignUpCooldown(60);
      } else {
        // ログイン処理
        await signIn(email, password);
        // ログイン成功後、ホームページにリダイレクト
        router.push("/");
      }
    } catch (err) {
      let errorMessage = "エラーが発生しました";
      
      if (err instanceof Error) {
        const message = err.message;
        
        // レート制限エラーの判定
        if (message.includes("rate limit") || message.includes("too many")) {
          errorMessage = "短時間に何度もメールが送信されています。数分待ってから再度お試しください。";
          // レート制限エラーの場合は60秒クールダウン
          setSignUpCooldown(60);
        } else if (message.includes("Email not confirmed")) {
          errorMessage = "メールアドレスが確認されていません。メールを確認してください";
        } else if (message.includes("Invalid login credentials")) {
          errorMessage = "メールアドレスまたはパスワードが正しくありません。";
        } else if (message.includes("User already registered")) {
          errorMessage = "このメールアドレスは既に登録されています。";
        } else {
          errorMessage = message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isSignUp ? "アカウント作成" : "ログイン"}
          </h2>
        </div>

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

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {isSignUp && (
            <div>
              <label htmlFor="displayName" className="sr-only">
                表示名
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="表示名"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="メールアドレス"
              required
              className={`appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 ${
                isSignUp ? "rounded-none" : "rounded-t-md"
              } focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`}
            />
          </div>

          <div>
            <label htmlFor="password" className="sr-only">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード"
              required
              className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || (isSignUp && signUpCooldown > 0)}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading 
              ? "処理中..." 
              : isSignUp 
                ? signUpCooldown > 0 
                  ? `${signUpCooldown}秒待機中...`
                  : "アカウント作成"
                : "ログイン"}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="w-full text-sm text-blue-600 hover:text-blue-500"
          >
            {isSignUp ? "ログイン画面に戻る" : "アカウントを作成する"}
          </button>
        </form>
      </div>
    </div>
  );
}
