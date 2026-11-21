import Link from "next/link";
import { redirect } from "next/navigation";
import { NewEsForm } from "@/components/es/new-es-form";
import { ES_TEMPLATES, getEsTemplate } from "@/lib/es-templates";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ company?: string; template?: string }>;
};

export default async function NewEsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("companies")
    .select("id,company_name")
    .eq("user_id", user.id)
    .order("company_name", { ascending: true });
  const params = await searchParams;

  if (error) {
    throw new Error("企業一覧を取得できませんでした");
  }

  const companies = data ?? [];
  const template = getEsTemplate(params.template);
  const showForm = Boolean(template) || params.template === "blank";
  const companyId = companies.some((company) => company.id === params.company) ? params.company! : "";
  const createUrl = (templateId?: string) => {
    const query = new URLSearchParams();
    if (companyId) query.set("company", companyId);
    if (templateId) query.set("template", templateId);
    return `/es/new${query.size ? `?${query}` : ""}`;
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="border-b bg-white">
        <div className="mx-auto flex min-h-16 max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-medium text-blue-600">ES管理</p>
            <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">新しいES</h1>
          </div>
          <Link href="/es" className="text-sm font-medium text-blue-600 hover:underline">ES一覧へ戻る</Link>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-8">
        {companies.length === 0 ? (
          <section className="rounded-xl bg-white p-8 text-center shadow">
            <h2 className="text-lg font-bold text-slate-950">先に企業を登録してください</h2>
            <p className="mt-2 text-sm text-slate-600">ESは企業に紐付けて保存します。</p>
            <Link href="/companies" className="mt-5 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">企業を登録</Link>
          </section>
        ) : showForm ? (
          <section className="rounded-xl bg-white p-5 shadow sm:p-7">
            <div className="mb-6 border-b border-slate-200 pb-5">
              <h2 className="text-lg font-bold text-slate-950">{template ? `${template.name}から作成` : "白紙から作成"}</h2>
              <p className="mt-2 text-sm text-slate-600">{template ? "本文は書き方のヒントです。自分の経験に置き換え、企業と内容を確認して保存してください。元テンプレートは変更されません。" : "企業を選び、タイトルと本文を入力してください。"}</p>
              <Link href={createUrl()} className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">作成方法の選択へ戻る（未保存の入力は破棄）</Link>
            </div>
            <NewEsForm key={params.template} companies={companies} initialValues={{
              company_id: companyId,
              title: template?.title ?? "",
              doc_type: template?.doc_type ?? "entry_sheet",
              content: template?.content ?? "",
            }} />
          </section>
        ) : (
          <section className="rounded-xl bg-white p-5 shadow sm:p-7">
            <h2 className="text-lg font-bold text-slate-950">作成方法を選ぶ</h2>
            <p className="mt-2 text-sm text-slate-600">テンプレートのヒントを使って書き始められます。選んだ後に内容を編集して保存できます。</p>
            {params.template ? <p role="alert" className="mt-3 text-sm text-rose-700">指定されたテンプレートはありません。以下から選び直してください。</p> : null}
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {ES_TEMPLATES.map((item) => (
                <Link key={item.id} href={createUrl(item.id)} className="rounded-lg border border-slate-300 p-4 hover:border-blue-500 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600">
                  <h3 className="font-bold text-slate-950">{item.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                  <span className="mt-3 block text-sm font-medium text-blue-600">このテンプレートを使う →</span>
                </Link>
              ))}
            </div>
            <Link href={createUrl("blank")} className="mt-5 inline-flex min-h-11 items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">白紙から作成</Link>
          </section>
        )}
      </main>
    </div>
  );
}
