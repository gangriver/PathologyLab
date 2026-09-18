"use client";
import { LocaleContext, useLocalePreference } from "@/hooks/use-locale";
import type { Locale } from "@/lib/i18n";

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useLocalePreference(locale);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
