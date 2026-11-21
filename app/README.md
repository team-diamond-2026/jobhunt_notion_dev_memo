This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 面接ログ（Issue #8）

ログイン後、ホームまたは企業一覧の「面接ログ」から利用できます。企業詳細では、その企業の面接記録の一覧・作成へ進めます。

### Supabaseの準備

1. `../supabase/README.md` に従って既存MVPマイグレーションを適用してください。既存の `interview_logs`（`interview_date: timestamptz`、`questions / answers: jsonb`）と企業・ワークスペースのRLSをそのまま使用します。
2. 続けて `../supabase/migrations/20261114000000_interview_log_access.sql` をSQL Editorまたは既存のSupabase CLI手順で適用してください。追加するのは企業別一覧用インデックスと入力列に絞った書き込み権限です。テーブル・既存データの型や値は変更しません。
3. `app/.env.local` にプロジェクトの `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定し、`npm run dev` を実行してください。サービスロールキーは使用しません。

面接日は日本時間で入力・表示し、質問・回答は改行ごとにJSON配列へ保存します。日時や振り返りがNULLの既存記録も表示できます。新規保存する記録には企業・面接日・形式が必須です。質問、回答、振り返り・改善点、次回までにやることは各10,000文字まで保存でき、未記入でも後から追記できます。

### 検証

`app` ディレクトリで実行します。

```bash
npm ci
npm test
npm run lint
npx tsc --noEmit
npm run build
npx playwright install chromium
npm run test:e2e
```

- `npm test`: 入力検証、認証・所有者確認、保存失敗、一覧・詳細の取得制限を検証します。PGliteのPostgresで既存MVPと追加のマイグレーションを実行し、他人のログの閲覧・更新・企業付け替えの拒否も確認します。
- `npm run test:e2e`: ローカルのSupabase APIモック（54329番）とNext.js（3108番）を起動し、PC・スマホのChromiumで新規保存・再読込・編集・企業絞り込み・空データ・未ログイン・保存失敗からの再試行を確認します。320〜1280pxで横にはみ出さないことも検証します。実際のSupabaseや実データには接続しません。
- 実環境へのマイグレーション適用と接続確認は別途必要です。2つのアカウントで、それぞれの企業・面接ログが相互に表示・変更できないことを確認してください。
