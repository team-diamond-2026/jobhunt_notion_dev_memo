import Link from "next/link";
import { interviewLink } from "./styles";

export default function InterviewNotFound() {
  return <div className="space-y-3"><h1 className="text-xl font-bold">面接ログまたは企業が見つかりません</h1><p>削除されたか、閲覧する権限がありません。</p><Link href="/interviews" className={interviewLink}>面接ログ一覧へ</Link></div>;
}
