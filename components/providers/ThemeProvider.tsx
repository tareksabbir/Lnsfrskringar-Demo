"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

// Cookie name is deliberately NOT "site-theme". It records only an explicit
// visitor choice, and the old name was written on first visit regardless of
// choice — see the note in the effect below. Renaming makes any stale
// "site-theme" cookie inert instead of requiring visitors to clear it.
const THEME_COOKIE = "site-theme-user";

function setThemeCookie(theme: Theme) {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; SameSite=Lax; max-age=31536000`;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to "dark" — matches the SSR fallback. On mount we sync from the
  // actual data-theme attribute (already set correctly by the server).
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme") as Theme | null;
    const current: Theme = attr === "light" ? "light" : "dark";

    // Only an explicit toggle may persist a theme.
    //
    // This used to also write the *current* theme as a cookie on first visit,
    // which permanently pinned whatever the site happened to render at that
    // moment — including the "dark" fallback shown before a ThemeManager
    // existed. That cookie then outranked the CMS "Default Theme Mode" forever,
    // so re-skinning a demo to a light vertical had no visible effect. The
    // server now falls back to the CMS default whenever no explicit choice
    // has been recorded.
    const hasCookie = document.cookie
      .split(";")
      .some(c => c.trim().startsWith(`${THEME_COOKIE}=`));

    if (!hasCookie) {
      try {
        // A stored localStorage value IS an explicit past choice, so migrate it.
        const ls = localStorage.getItem("site-theme") as Theme | null;
        if (ls === "light" || ls === "dark") {
          setThemeCookie(ls);
          if (ls !== current) {
            document.documentElement.setAttribute("data-theme", ls);
            setTheme(ls);
            return;
          }
        }
      } catch { /* private mode / storage disabled — fall through to CMS default */ }
    }

    setTheme(current);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      setThemeCookie(next);
      try { localStorage.setItem("site-theme", next); } catch {}
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
