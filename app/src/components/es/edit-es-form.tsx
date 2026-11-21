"use client";

import { useActionState } from "react";
import { updateEsDocument } from "@/app/es/actions";
import type { EsDocument } from "@/lib/es";
import { EsForm, type EsCompanyOption } from "./es-form";

export function EditEsForm({ companies, document }: {
  companies: EsCompanyOption[];
  document: EsDocument;
}) {
  const [state, action, pending] = useActionState(updateEsDocument, undefined);

  // Remount on failure so select defaults survive React's form reset too.
  return <EsForm
    key={state?.attempt ?? 0}
    action={action}
    companies={companies}
    document={{ ...document, ...state?.values }}
    error={state?.error}
    pending={pending}
    submitLabel="変更を保存"
  />;
}
