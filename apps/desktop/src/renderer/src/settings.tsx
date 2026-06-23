import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { translate, type Lang, type StringKey } from "./i18n";

export type Theme = "dark" | "light";

interface Settings {
  theme: Theme;
  setTheme: (t: Theme) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Translate a UI string in the current language. */
  t: (key: StringKey) => string;
}

const SettingsContext = createContext<Settings | null>(null);

function stored<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback;
  } catch {
    return fallback;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }): JSX.Element {
  const [theme, setTheme] = useState<Theme>(() => stored<Theme>("cowork.theme", "dark"));
  const [lang, setLang] = useState<Lang>(() => stored<Lang>("cowork.lang", "pt-BR"));

  // Apply + persist the theme via a root attribute the CSS keys off of.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("cowork.theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem("cowork.lang", lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  const value: Settings = { theme, setTheme, lang, setLang, t: (key) => translate(lang, key) };
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Settings {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
