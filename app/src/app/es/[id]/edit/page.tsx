import { PageHeading } from "@/components/page-heading";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EsForm } from "@/components/es/es-form";
import { EsDocument } from "@/lib/es";
import { createClient } from "@/lib/supabase/server";
import { updateEsDocument } from "../../actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EsEditPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: document }, { data: companies, error }] = await Promise.all([
    supabase
      .from("es_documents")
      .select("id,company_id,doc_type,title,content,version,created_at,updated_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("companies")
      .select("id,company_name")
      .eq("user_id", user.id)
      .order("company_name", { ascending: true }),
  ]);

  if (!document || error) {
    notFound();
  }

  return (
    <div className="ui-workspace">
      <div className="ui-toolbar ui-toolbar-narrow"><Link href={`/es/${id}`} className="ui-link">← ES詳細へ戻る</Link></div>

      <main id="main-content" className="ui-main ui-main-narrow space-y-6">
        <PageHeading title="ESを編集" description="内容を更新して、最新の下書きを保存しましょう。" />
        <section className="ui-panel">
          <EsForm action={updateEsDocument} companies={companies ?? []} document={document as EsDocument} error={query.error} submitLabel="変更を保存" />
        </section>
      </main>
    </div>
  );
}
