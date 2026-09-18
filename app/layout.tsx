import type { Metadata } from "next";
import { getLab } from "@/lib/lab";
import { getLocale } from "@/lib/locale-server";
import { shellCopy } from "@/lib/i18n";
import { LocaleProvider } from "@/components/locale-provider";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const lab = getLab(locale);
  return { title: { default: lab.name, template: "%s | " + lab.name }, description: shellCopy[locale].description };
}
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return <html lang={locale}><body><LocaleProvider locale={locale}><a className="skip-link" href="#main">{shellCopy[locale].skip}</a>{children}</LocaleProvider></body></html>;
}
