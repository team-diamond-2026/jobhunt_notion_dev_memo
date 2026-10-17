import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { createClient } from "../lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shukatsu OS | 就活管理",
  description: "企業研究、選考状況、ESをまとめて管理する就活ワークスペース",
};

function getThemeClass(settings: unknown) {
  if (
    typeof settings === "object" &&
    settings !== null &&
    "theme" in settings
  ) {
    const theme = (settings as { theme?: unknown }).theme;

    if (theme === "dark") {
      return "dark";
    }

    if (theme === "system") {
      return "theme-system";
    }

    if (theme === "light") {
      return "";
    }
  }

  return "theme-system";
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const themeClass = getThemeClass(user?.user_metadata?.settings);

  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} ${themeClass} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {user && <AppHeader displayName={user.user_metadata?.display_name || user.email || "ユーザー"} />}
        {children}
      </body>
    </html>
  );
}
