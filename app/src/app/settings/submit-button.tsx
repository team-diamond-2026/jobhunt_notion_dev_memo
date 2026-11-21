"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="ui-button ui-primary w-full sm:w-auto"
    >
      {pending ? "保存中..." : "設定を保存"}
    </button>
  );
}
