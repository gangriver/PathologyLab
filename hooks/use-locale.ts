"use client";
import { createContext, useContext, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";

type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => void; pending: boolean };
export const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocalePreference(locale: Locale): LocaleContextValue {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  function setLocale(next: Locale) {
    if (next === locale || pending) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    startTransition(() => { router.refresh(); });
  }
  return { locale, setLocale, pending };
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("언어 설정을 불러오지 못했습니다.");
  return context;
}
