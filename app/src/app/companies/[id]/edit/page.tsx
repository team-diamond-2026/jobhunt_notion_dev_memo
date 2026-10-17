import { PageHeading } from "@/components/page-heading";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";
import { updateCompany } from "../../actions";
import { getIndustryFormValues } from "../../industry";
import { IndustryFields } from "../../industry-fields";
import {
  getSelectionStatusIndex,
  SELECTION_STATUS_OPTIONS,
} from "../../../../lib/selection-status";

type Company = {
  id: string;
  user_id: string;
  company_name: string;
  industry: string | null;
  industry_category: string | null;
  motivation_level: number;
  selection_status: string;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CompanyEditPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    notFound();
  }

  const company = data as Company;
  const progressIndex = getSelectionStatusIndex(company.selection_status);
  const industryFormValues = getIndustryFormValues(
    company.industry_category,
    company.industry,
  );

  return (
    <div className="ui-workspace">
      <div className="ui-toolbar ui-toolbar-narrow"><Link href={`/companies/${company.id}`} className="ui-link">← 企業詳細へ戻る</Link></div>

      <main id="main-content" className="ui-main ui-main-narrow space-y-6">
        <PageHeading title="企業編集" description="企業情報と選考状況を見直して、最新の情報を保存しましょう。" />
        <section className="ui-panel">
          <h2 className="text-2xl font-bold text-black mb-6">企業情報を編集</h2>

          <form action={updateCompany} className="grid gap-4">
            <input type="hidden" name="company_id" value={company.id} />

            <div>
              <label htmlFor="company_name" className="ui-label">企業名 *</label>
              <input
                id="company_name"
                name="company_name"
                type="text"
                required
                defaultValue={company.company_name}
                className="ui-field"
              />
            </div>

            <IndustryFields
              initialCategory={industryFormValues.category}
              initialOther={industryFormValues.other}
            />

            <div>
              <label htmlFor="motivation_level" className="ui-label">志望度</label>
              <select
                id="motivation_level"
                name="motivation_level"
                defaultValue={String(company.motivation_level)}
                className="ui-field"
              >
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </div>

            <div>
              <label htmlFor="selection_status" className="ui-label">選考ステータス</label>
              <select
                id="selection_status"
                name="selection_status"
                defaultValue={company.selection_status}
                className="ui-field"
              >
                {SELECTION_STATUS_OPTIONS.map((status, index) => (
                  <option
                    key={status}
                    value={status}
                    disabled={index < progressIndex}
                  >
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="memo" className="ui-label">メモ</label>
              <textarea
                id="memo"
                name="memo"
                rows={5}
                defaultValue={company.memo ?? ""}
                className="ui-field"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="ui-button ui-primary"
              >
                更新する
              </button>

              <Link
                href={`/companies/${company.id}`}
                className="ui-button ui-secondary"
              >
                キャンセル
              </Link>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
