import Link from "next/link";
export default function NotFound() {
  return <main id="main" className="shell page-shell"><div className="empty-state"><h1>페이지를 찾을 수 없습니다.</h1><p>주소를 확인하거나 홈으로 돌아가주세요.</p><Link href="/" className="button">홈으로 돌아가기</Link></div></main>;
}
