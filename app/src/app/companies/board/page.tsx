import { PageHeading } from "@/components/page-heading";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { SELECTION_STATUS_OPTIONS } from "../../../lib/selection-status";

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

export default async function CompaniesBoardPage() {
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
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`企業データの取得に失敗しました: ${error.message}`);
  }

  const companies = (data ?? []) as Company[];

  const groupedCompanies = SELECTION_STATUS_OPTIONS.map((status) => ({
    status,
    items: companies.filter((company) => company.selection_status === status),
  }));

  return (
    <div className="ui-workspace">
      <main id="main-content" className="ui-main space-y-6">
        <PageHeading title="選考ボード" description="企業を選考状況ごとに確認できます。横にスクロールして各段階を見渡せます。" />

        <section className="overflow-x-auto rounded-xl pb-4" tabIndex={0} aria-label="選考状況ごとの企業。左右にスクロールできます">
          <div className="grid grid-flow-col auto-cols-[min(20rem,85vw)] gap-4 min-w-max">
            {groupedCompanies.map((group) => (
              <div
                key={group.status}
                className="ui-panel flex flex-col gap-4 min-h-[500px]"
              >
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-lg font-bold text-black">{group.status}</h3>
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-black text-sm">
                    {group.items.length}件
                  </span>
                </div>

                {group.items.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    このステータスの企業はありません。
                  </p>
                ) : (
                  <div className="space-y-3">
                    {group.items.map((company) => (
                      <Link
                        key={company.id}
                        href={`/companies/${company.id}`}
                        className="ui-board-card"
                      >
                        <h4 className="font-semibold text-black">
                          {company.company_name}
                        </h4>

                        <p className="text-sm text-slate-600 mt-2">
                          業界: {company.industry || "未設定"}
                        </p>
                        <p className="text-sm text-slate-600">
                          志望度: {company.motivation_level}
                        </p>
                        <p className="text-sm text-slate-600 line-clamp-3">
                          メモ: {company.memo || "なし"}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
