import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { AppProviders } from "@/components/AppProviders";
import { Nav } from "@/components/Nav";
import { INIT_DASHBOARD_WIDTH_SCRIPT } from "@/lib/dashboardWidthStorage";
import { LOCALE_COOKIE_NAME, resolveLocale, translate } from "@/lib/i18n";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Personal dashboard",
    template: "%s · Personal dashboard",
  },
  description: "Local JSON-backed tasks, owners, and notes",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialLocale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const t = (key: Parameters<typeof translate>[1], values?: Parameters<typeof translate>[2]) =>
    translate(initialLocale, key, values);
  const year = new Date().getFullYear();

  return (
    <html
      lang={initialLocale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <script dangerouslySetInnerHTML={{ __html: INIT_DASHBOARD_WIDTH_SCRIPT }} />
        <AppProviders initialLocale={initialLocale}>
          <div className="flex min-h-full flex-1 flex-col">
            <Nav />
            <div className="flex-1">{children}</div>
            <footer className="border-t border-zinc-200/80 py-3 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              {t("app.footer", { year })}
            </footer>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
