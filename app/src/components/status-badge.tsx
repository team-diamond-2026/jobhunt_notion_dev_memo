export function StatusBadge({ status }: { status: string }) {
  const tone = status === "内定" ? "success"
    : status.includes("面接") ? "progress"
    : ["不採用", "辞退"].includes(status) ? "neutral"
    : ["応募済み", "書類選考中"].includes(status) ? "active"
    : "neutral";

  return <span className="ui-status-badge" data-tone={tone}>{status}</span>;
}
