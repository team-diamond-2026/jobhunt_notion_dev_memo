import { expect, test } from "@playwright/test";

const companyId = "00000000-0000-0000-0000-000000000008";
const userId = "00000000-0000-0000-0000-000000000001";
const fakeApi = "http://127.0.0.1:54329";

test.beforeEach(async ({ context, request }) => {
  await request.post(`${fakeApi}/test/reset`);
  const expires_at = Math.floor(Date.now() / 1000) + 3600;
  const encode = (data: object) => Buffer.from(JSON.stringify(data)).toString("base64url");
  const access_token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, role: "authenticated", aud: "authenticated", exp: expires_at })}.test-signature`;
  const session = { access_token, refresh_token: "test-refresh", expires_at, expires_in: 3600, token_type: "bearer", user: { id: userId } };
  await context.addCookies([{ name: "sb-127-auth-token", value: `base64-${encode(session)}`, domain: "127.0.0.1", path: "/" }]);
});

test("面接記録を作成・再読込・編集し、企業詳細から見返せる", async ({ page }) => {
  await page.goto(`/interviews?company_id=${companyId}`);
  await expect(page.getByText("まだこの企業の面接ログはありません。")).toBeVisible();
  await page.getByRole("link", { name: "最初の面接を記録" }).click();
  await expect(page.getByLabel("企業（必須）")).toHaveValue(companyId);
  await page.getByLabel("面接日（必須）").fill("2026-11-14");
  await page.getByLabel("面接形式（必須）").selectOption("オンライン");
  await page.getByLabel("質問内容", { exact: true }).fill("自己紹介\n学生時代に力を入れたこと");
  await page.getByLabel("回答内容", { exact: true }).fill("チーム開発の経験を話した。");
  await page.getByLabel("振り返り・改善点", { exact: true }).fill("結論から話す。");
  await page.getByLabel("次回までにやること", { exact: true }).fill("1分で話す練習をする。");
  await page.getByRole("button", { name: "面接ログを保存", exact: true }).click();
  await expect(page).toHaveURL(/\/interviews\/[0-9a-f-]{36}$/);
  await page.reload();
  await expect(page.getByText("自己紹介\n学生時代に力を入れたこと", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "この記録を編集" }).click();
  await expect(page.getByLabel("振り返り・改善点", { exact: true })).toHaveValue("結論から話す。");
  await page.getByLabel("振り返り・改善点", { exact: true }).fill("成果を数字で伝える。\n具体例を追加する。");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(page.getByText("成果を数字で伝える。\n具体例を追加する。", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "企業詳細", exact: true }).click();
  await expect(page.getByRole("link", { name: "サンプル企業の面接記録" })).toBeVisible();
  await page.getByRole("link", { name: "この企業の面接ログ一覧", exact: true }).click();
  await page.getByLabel("企業で絞り込み").selectOption("00000000-0000-0000-0000-000000000009");
  await page.getByRole("button", { name: "表示する" }).click();
  await expect(page.getByText("まだこの企業の面接ログはありません。")).toBeVisible();
});

test("保存エラー後も入力を保持して再試行でき、スマホ幅で横にはみ出さない", async ({ page, request }) => {
  await page.goto(`/interviews/new?company_id=${companyId}`);
  await page.getByLabel("面接日（必須）").fill("2026-11-14");
  await page.getByLabel("面接形式（必須）").selectOption("対面");
  const reflection = `失敗しても残したい内容\n${"VeryLongWord".repeat(30)}`;
  await page.getByLabel("振り返り・改善点", { exact: true }).fill(reflection);
  await request.post(`${fakeApi}/test/fail-next-save`);
  await page.getByRole("button", { name: "面接ログを保存", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "保存できませんでした" })).toBeVisible();
  await expect(page.getByLabel("振り返り・改善点", { exact: true })).toHaveValue(reflection);
  await expect(page.getByLabel("面接日（必須）")).toHaveValue("2026-11-14");
  await expect(page.getByLabel("面接形式（必須）")).toHaveValue("対面");
  await expect(page.getByLabel("企業（必須）")).toHaveValue(companyId);
  await page.getByRole("button", { name: "面接ログを保存", exact: true }).click();
  await expect(page).toHaveURL(/\/interviews\/[0-9a-f-]{36}$/);
  await expect(page.getByText(reflection, { exact: true })).toBeVisible();
  for (const width of [320, 375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: test.info().outputPath("interview-detail.png"), fullPage: true });
  await page.getByRole("link", { name: "この記録を編集" }).click();
  for (const width of [320, 375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: test.info().outputPath("interview-form.png"), fullPage: true });
});

test("企業がなければ企業登録を案内し、未ログインでは入力ページに入れない", async ({ page, request, context }) => {
  await request.post(`${fakeApi}/test/no-companies`);
  await page.goto("/interviews/new");
  await expect(page.getByRole("link", { name: "企業を登録する", exact: true })).toBeVisible();
  await context.clearCookies();
  await page.goto("/interviews/new");
  await expect(page).toHaveURL(/\/login$/);
});
