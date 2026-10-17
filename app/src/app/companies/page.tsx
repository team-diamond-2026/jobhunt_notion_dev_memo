import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { deleteCompany } from "./actions";
import { CompanyCreateForm } from "./create-form";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { SELECTION_STATUS_OPTIONS } from "../../lib/selection-status";

type Company = {
  id: string;
  user_id: string;
  company_name: string;
  industry: string | null;
  motivation_level: number;
  selection_status: string;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

type PageProps = {
  searchParams: Promise<{
    keyword?: string;
    industry?: string;
    status?: string;
    sort?: string;
  }>;
};

const SORT_OPTIONS = [
  { value: "updated_desc", label: "更新日が新しい順" },
  { value: "updated_asc", label: "更新日が古い順" },
  { value: "motivation_desc", label: "志望度が高い順" },
  { value: "motivation_asc", label: "志望度が低い順" },
  { value: "name_asc", label: "企業名 A-Z" },
];

function getSort(sort: string) {
  switch (sort) {
    case "updated_asc":
      return { column: "updated_at", ascending: true };
    case "motivation_desc":
      return { column: "motivation_level", ascending: false };
    case "motivation_asc":
      return { column: "motivation_level", ascending: true };
    case "name_asc":
      return { column: "company_name", ascending: true };
    default:
      return { column: "updated_at", ascending: false };
  }
}

function getUpdatedLabel(value: string) {
  return new Date(value).toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
  });
}

export default async function CompaniesPage({ searchParams }: PageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const keyword = String(resolvedSearchParams.keyword ?? "").trim();
  const industry = String(resolvedSearchParams.industry ?? "").trim();
  const status = String(resolvedSearchParams.status ?? "all").trim();
  const sort = String(resolvedSearchParams.sort ?? "updated_desc").trim();
  const sortOption = getSort(sort);

  let query = supabase
    .from("companies")
    .select("*")
    .order(sortOption.column, { ascending: sortOption.ascending });

  if (keyword) {
    query = query.ilike("company_name", `%${keyword}%`);
  }

  if (industry) {
    query = query.ilike("industry", `%${industry}%`);
  }

  if (status !== "all") {
    query = query.eq("selection_status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`企業一覧の取得に失敗しました: ${error.message}`);
  }

  const companies = (data ?? []) as Company[];
  const hasFilters = Boolean(keyword || industry || status !== "all");

  return (
    <div className="ui-workspace">
      <main id="main-content" className="ui-main space-y-6">
        <PageHeading title="企業一覧" description="気になる企業と選考状況を整理して、次の準備につなげましょう。" />

        <details id="add-company" className="ui-panel group">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 font-semibold">
            <span>＋ 企業を追加</span>
            <span className="text-sm font-normal text-slate-600 group-open:hidden">開いて登録フォームを表示</span>
            <span className="hidden text-sm font-normal text-slate-600 group-open:inline">閉じる</span>
          </summary>
          <CompanyCreateForm />
        </details>

        <section className="ui-panel" aria-labelledby="company-results-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="company-results-title" className="text-xl font-bold">登録済み企業</h2>
              <p className="mt-1 text-sm text-slate-600">企業名・業界・選考状況から、確認したい企業を見つけられます。</p>
            </div>
            <Link href="/companies/board" className="ui-button ui-secondary">選考ボードで見る</Link>
          </div>

          <form method="get" role="search" aria-label="企業の検索と絞り込み" className="ui-search-form">
            <div>
              <label htmlFor="keyword" className="ui-label">企業名</label>
              <input id="keyword" name="keyword" type="search" defaultValue={keyword} placeholder="企業名で検索" className="ui-field" />
            </div>
            <div>
              <label htmlFor="filter-industry" className="ui-label">業界</label>
              <input id="filter-industry" name="industry" type="search" defaultValue={industry} placeholder="例: IT・通信" className="ui-field" />
            </div>
            <div>
              <label htmlFor="status" className="ui-label">選考状況</label>
              <select id="status" name="status" defaultValue={status} className="ui-field">
                <option value="all">すべての状況</option>
                {SELECTION_STATUS_OPTIONS.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="sort" className="ui-label">並び順</label>
              <select id="sort" name="sort" defaultValue={sort} className="ui-field">
                {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
              <button type="submit" className="ui-button ui-primary flex-1 sm:flex-none">検索する</button>
              <Link href="/companies" className="ui-button ui-secondary flex-1 sm:flex-none">条件をクリア</Link>
            </div>
          </form>

          <p className="my-5 text-sm text-slate-600" role="status">
            {hasFilters ? "条件に一致する企業" : "登録済み企業"}: <strong className="text-slate-950">{companies.length} 件</strong>
          </p>
          {companies.length === 0 ? (
            <div className="ui-empty-state rounded-xl bg-slate-50">
              <h3 className="text-lg font-semibold">{hasFilters ? "条件に一致する企業がありません" : "最初の企業を登録しましょう"}</h3>
              <p className="mt-2 text-sm text-slate-600">{hasFilters ? "企業名の一部で検索するか、条件をクリアしてもう一度確認してください。" : "上の「企業を追加」を開くと、企業情報と選考状況を登録できます。"}</p>
              {hasFilters && <Link href="/companies" className="ui-button ui-secondary mt-5">条件をクリアして全件表示</Link>}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {companies.map((company) => (
                <article key={company.id} className="ui-company-card" aria-label={company.company_name}>
                  <StatusBadge status={company.selection_status} />
                  <h3 className="mt-3 text-lg font-bold">
                    <Link href={`/companies/${company.id}`} className="hover:text-blue-600 hover:underline">{company.company_name}</Link>
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">{company.industry || "業界未設定"}</p>
                  <dl className="mt-4 flex items-center justify-between gap-2 text-sm">
                    <dt className="text-slate-600">志望度</dt>
                    <dd className="font-semibold">{company.motivation_level} / 5</dd>
                  </dl>
                  <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{company.memo || "メモはまだありません。"}</p>
                  <p className="mt-auto pt-4 text-xs text-slate-500">更新: {getUpdatedLabel(company.updated_at)}</p>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                    <Link href={`/companies/${company.id}`} className="ui-button ui-primary flex-1">詳細</Link>
                    <Link href={`/companies/${company.id}/edit`} className="ui-button ui-secondary flex-1">編集</Link>
                    <form action={deleteCompany}>
                      <input type="hidden" name="company_id" value={company.id} />
                      <button type="submit" className="ui-button ui-danger" aria-label={`${company.company_name}を削除`}>削除</button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
