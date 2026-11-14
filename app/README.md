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

## 選考ボードの検証

`npm test` で、ステータス更新の認証・所有者制限・入力検証と、ボードの移動・保存失敗時の復元を検証できます。Supabaseへの接続はモックされるため、テストで実際の企業情報は変更しません。

実環境では、ログイン後に「企業一覧」→「選考ボード」へ進み、次を確認します。

- カードを空の列へドラッグし、移動先が強調されること
- ドロップ後、再読み込みや企業一覧でもステータスが保持されること
- 「移動先」セレクトをスマホ・キーボードで操作できること
- 保存失敗時にカードが元の列へ戻り、再操作できること
- 同じ列へのドロップやドラッグのキャンセルでは更新しないこと
