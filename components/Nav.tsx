"use client";

import Link from "next/link";
import { ThemeProvider } from "@mui/material/styles";
import ExpandedThemeBox from "@/components/ExpandedThemeBox";
import { LandscapeThemeToggle } from "@/components/LandscapeThemeToggle";
import { useTheme } from "@/components/ThemeProvider";
import { dashboardMuiTheme } from "@/lib/muiDashboardTheme";

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

export function Nav() {
  return (
    <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <div className="flex flex-wrap items-center gap-6">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            Dashboard
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm font-medium">
            <Link
              href="/"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Tasks
            </Link>
            <Link
              href="/notes"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Notes
            </Link>
            <Link
              href="/epics"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Epics
            </Link>
            <Link
              href="/projects"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Projects
            </Link>
            <Link
              href="/owners"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Owners
            </Link>
            <Link
              href="/achievements"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Achievements
            </Link>
            <Link
              href="/docs/markdown"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Markdown
            </Link>
            <Link
              href="/settings"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Settings
            </Link>
            <Link
              href="/audit"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Audit log
            </Link>
          </nav>
        </div>
        <NavThemeSwitch />
      </div>
    </header>
  );
}
