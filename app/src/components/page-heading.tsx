import type { ReactNode } from "react";

export function PageHeading({ title, description, children }: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="ui-page-heading">
      <div className="min-w-0">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </header>
  );
}
