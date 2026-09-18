"use client";
import { useRouter } from "next/navigation";
import { useApiRequest } from "./use-api-request";
import { useLocale } from "./use-locale";
import { getFormMessages } from "@/lib/i18n-form";

export function usePaperActions(id: string, revision: number) {
  const router = useRouter();
  const { locale } = useLocale();
  const text = getFormMessages(locale);
  const { pending, error, send } = useApiRequest();
  async function remove() {
    if (!window.confirm(text.deletePaperConfirm)) return;
    const result = await send("/api/papers/" + id, "DELETE", { revision });
    if (result) { router.replace("/papers"); router.refresh(); }
  }
  return { text, pending, error, remove };
}
