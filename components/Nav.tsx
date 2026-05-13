"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "@mui/material/styles";
import ExpandedThemeBox from "@/components/ExpandedThemeBox";
import { LanguageSelect } from "@/components/LanguageSelect";
import { LandscapeThemeToggle } from "@/components/LandscapeThemeToggle";
import { useI18n } from "@/components/LocaleProvider";
import { useTheme } from "@/components/ThemeProvider";
import { dashboardMuiTheme } from "@/lib/muiDashboardTheme";
import { GlobalSearch } from "@/components/GlobalSearch";

function NavThemeSwitch() {
  const { setTheme, resolvedDark, themeNavToggle } = useTheme();
  const toggleTheme = () => {
    setTheme(resolvedDark ? "light" : "dark");
  };
  if (themeNavToggle === "scenic") {
    return <LandscapeThemeToggle resolvedDark={resolvedDark} onToggle={toggleTheme} />;
  }
  return (
    <ThemeProvider theme={dashboardMuiTheme}>
      <ExpandedThemeBox isChecked={resolvedDark} toggleTheme={toggleTheme} />
    </ThemeProvider>
  );
}

const NAV_LINK_CLASS =
  "rounded-md px-1.5 py-1 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100";
const NAV_LINK_ACTIVE_CLASS =
  "bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900/70";

const NAV_ITEMS = [
  {
    href: "/",
    labelKey: "nav.tasks",
    isActive: (pathname: string) => pathname === "/" || pathname.startsWith("/tasks"),
  },
  {
    href: "/notes",
    labelKey: "nav.notes",
    isActive: (pathname: string) => pathname.startsWith("/notes"),
  },
  {
    href: "/epics",
    labelKey: "nav.epics",
    isActive: (pathname: string) => pathname.startsWith("/epics"),
  },
  {
    href: "/projects",
    labelKey: "nav.projects",
    isActive: (pathname: string) => pathname.startsWith("/projects"),
  },
  {
    href: "/owners",
    labelKey: "nav.owners",
    isActive: (pathname: string) => pathname.startsWith("/owners"),
  },
  {
    href: "/worklogs",
    labelKey: "nav.worklogs",
    isActive: (pathname: string) => pathname.startsWith("/worklogs"),
  },
  {
    href: "/achievements",
    labelKey: "nav.achievements",
    isActive: (pathname: string) => pathname.startsWith("/achievements"),
  },
  {
    href: "/docs/markdown",
    labelKey: "nav.markdown",
    isActive: (pathname: string) => pathname.startsWith("/docs/markdown"),
  },
  {
    href: "/settings",
    labelKey: "nav.settings",
    isActive: (pathname: string) => pathname.startsWith("/settings"),
  },
  {
    href: "/audit",
    labelKey: "nav.audit",
    isActive: (pathname: string) => pathname.startsWith("/audit"),
  },
] as const;

export function Nav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-[min(100%,96rem)] items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            {t("nav.dashboard")}
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium">
            {NAV_ITEMS.map((item) => {
              const active = item.isActive(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`${NAV_LINK_CLASS} ${active ? NAV_LINK_ACTIVE_CLASS : ""}`}
                >
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>
          <GlobalSearch />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <LanguageSelect />
          <NavThemeSwitch />
        </div>
      </div>
    </header>
  );
}
