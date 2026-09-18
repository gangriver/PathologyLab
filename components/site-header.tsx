import Link from "next/link";
import { lab } from "@/lib/lab";

export function SiteHeader() {
  return <header className="site-header"><div className="shell header-inner">
    <Link href="/" className="brand" aria-label={lab.name + " 홈"}><span className="brand-mark" aria-hidden="true">ㄹ</span><span>{lab.name}<small>연구와 기록의 공간</small></span></Link>
    <nav aria-label="주 메뉴"><Link href="/#members">멤버 소개</Link><Link href="/papers">논문 아카이브</Link><Link href="/papers/new" className="button button-small">논문 등록 <span aria-hidden="true">↗</span></Link></nav>
  </div></header>;
}
