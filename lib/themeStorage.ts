export const DASHBOARD_THEME_STORAGE_KEY = "dashboard-theme";

/** Inline in `<head>` so the first paint matches stored / system theme (no flash). */
export const INIT_THEME_SCRIPT = `(function(){try{var k=${JSON.stringify(
  DASHBOARD_THEME_STORAGE_KEY,
)};var t=localStorage.getItem(k)||"system";var mq=window.matchMedia("(prefers-color-scheme: dark)");var dark=t==="dark"||(t!=="light"&&mq.matches);document.documentElement.classList.toggle("dark",dark);document.documentElement.style.colorScheme=dark?"dark":"light";}catch(e){}})();`;

export type ThemeMode = "light" | "dark" | "system";

export function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

function syncColorScheme(dark: boolean) {
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

/** Sync `<html class="dark">` with stored preference and system appearance. */
export function applyDashboardTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const dark = theme === "dark" || (theme === "system" && mq.matches);

  const apply = () => {
    document.documentElement.classList.toggle("dark", dark);
    syncColorScheme(dark);
    // Must run here (not after startViewTransition returns): the callback can run
    // after the old snapshot, so subscribers must re-read the DOM only once class is updated.
    window.dispatchEvent(new Event("dashboard-theme"));
  };

  if (document.documentElement.classList.contains("dark") === dark) {
    syncColorScheme(dark);
    return;
  }

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  type ViewTransitionLike = {
    finished?: Promise<unknown>;
    ready?: Promise<unknown>;
    updateCallbackDone?: Promise<unknown>;
  };
  const startVT = (
    document as Document & {
      startViewTransition?: (callback: () => void) => ViewTransitionLike;
    }
  ).startViewTransition;

  if (reduceMotion || typeof startVT !== "function") {
    apply();
    return;
  }

  // Skipped transitions (rapid toggle, HMR reload, navigation, etc.) reject
  // .finished / .ready / .updateCallbackDone with AbortError: "Transition was
  // skipped". Swallow them — the DOM was already updated synchronously inside
  // `apply`, so the visual transition is purely cosmetic.
  const transition = startVT.call(document, apply);
  const swallow = () => {};
  transition?.finished?.catch(swallow);
  transition?.ready?.catch(swallow);
  transition?.updateCallbackDone?.catch(swallow);
}
