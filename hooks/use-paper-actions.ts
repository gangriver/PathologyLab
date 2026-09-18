"use client";
import { useRouter } from "next/navigation";
import { useApiRequest } from "./use-api-request";

export function usePaperActions(id: string, revision: number) {
  const router = useRouter();
  const { pending, error, send } = useApiRequest();
  async function remove() {
    if (!window.confirm("이 논문과 연결된 토론 기록을 삭제할까요? 삭제하면 되돌릴 수 없습니다.")) return;
    const result = await send("/api/papers/" + id, "DELETE", { revision });
    if (result) { router.replace("/papers"); router.refresh(); }
  }
  return { pending, error, remove };
}
