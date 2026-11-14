"use client";

import { useActionState } from "react";
import { createEsDocument } from "@/app/es/actions";
import type { EsDraftValues } from "@/lib/es-templates";
import { EsForm, type EsCompanyOption } from "./es-form";

export function NewEsForm({ companies, initialValues }: {
  companies: EsCompanyOption[];
  initialValues: EsDraftValues;
}) {
  const [state, action, pending] = useActionState(createEsDocument, undefined);

  return <EsForm
    key={state?.attempt ?? 0}
    action={action}
    companies={companies}
    initialValues={state?.values ?? initialValues}
    error={state?.error}
    pending={pending}
    submitLabel="下書きを保存"
  />;
}
