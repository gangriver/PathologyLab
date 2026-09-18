"use client";
import { useCommentForm } from "@/hooks/use-comment-form";
import type { Comment } from "@/lib/types";

export function Comments({ paperId, comments }: { paperId: string; comments: Comment[] }) {
  const { pending, error, submit } = useCommentForm(paperId);
  return <section className="panel" style={{ marginTop: 25 }}><h2 style={{ fontSize: 20, fontWeight: 700 }}>랩미팅 토론 <span className="muted">{comments.length}</span></h2>
    {comments.length ? comments.map(comment => <article key={comment.id} className="comment"><div className="comment-top"><strong>{comment.authorName}</strong><time dateTime={comment.createdAt}>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(comment.createdAt))}</time></div><p>{comment.content}</p></article>) : <p className="form-note">아직 토론 기록이 없습니다. 랩미팅에서 나온 질문이나 의견을 남겨주세요.</p>}
    <form onSubmit={submit} style={{ marginTop: 22 }}><label className="field">토론 기록<textarea name="content" required maxLength={5000} rows={4} placeholder="함께 나눈 질문, 해석, 후속 연구 아이디어를 기록해주세요." /></label>{error && <p className="alert alert-error" role="alert">{error}</p>}<div className="form-footer"><button className="button" disabled={pending}>{pending ? "저장 중…" : "토론 남기기"}</button></div></form>
  </section>;
}
