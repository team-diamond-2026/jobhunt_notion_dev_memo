import { PageHeading } from "@/components/page-heading";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EsForm } from "@/components/es/es-form";
import { createClient } from "@/lib/supabase/server";
import { createEsDocument } from "../actions";

type PageProps = {
  searchParams: Promise<{ company?: string; error?: string }>;
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

  return (
    <div className="ui-workspace">
      <div className="ui-toolbar ui-toolbar-narrow"><Link href="/es" className="ui-link">← ES一覧へ戻る</Link></div>

      <main id="main-content" className="ui-main ui-main-narrow space-y-6">
        <PageHeading title="新しいES" description="企業と文書の種類を選んで、下書きを保存できます。" />
        {companies.length === 0 ? (
          <section className="ui-panel text-center">
            <h2 className="text-lg font-bold text-slate-950">先に企業を登録してください</h2>
            <p className="mt-2 text-sm text-slate-600">ESは企業に紐付けて保存します。</p>
            <Link href="/companies" className="ui-button ui-primary mt-5">企業を登録</Link>
          </section>
        ) : (
          <section className="ui-panel">
            <EsForm action={createEsDocument} companies={companies} defaultCompanyId={params.company} error={params.error} submitLabel="下書きを保存" />
          </section>
        )}
      </main>
    </div>
  );
}
