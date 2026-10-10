import { createContext, useState, useEffect } from 'react';

export const UIContext = createContext();

export const THEME_TOKENS = {
  light: {
    "--bg": "#fafaf7",
    "--fg": "#111827",
    "--card": "#ffffff",
    "--card-fg": "#111827",
    "--primary": "#5f513f",
    "--primary-fg": "#ffffff",
    "--secondary": "#f3f0ea",
    "--secondary-fg": "#5f513f",
    "--muted": "#f5f4ef",
    "--muted-fg": "#6b7280",
    "--accent": "#b28a64",
    "--accent-fg": "#ffffff",
    "--border": "#ece7dd",
    "--sidebar-bg": "#f5f4f0",
    "--sidebar-border": "#eae8e1",
    "--shadow-card": "0 2px 8px rgba(0, 0, 0, 0.04)",
    "--shadow-hover": "0 8px 24px rgba(0, 0, 0, 0.08)",
    "color-scheme": "light",
  },
  dark: {
    "--bg": "#121110",
    "--fg": "#f5efe4",
    "--card": "#1e1b17",
    "--card-fg": "#f5efe4",
    "--primary": "#d4a373",
    "--primary-fg": "#121110",
    "--secondary": "#28231e",
    "--secondary-fg": "#f5efe4",
    "--muted": "#231f1a",
    "--muted-fg": "#a89f91",
    "--accent": "#e0b483",
    "--accent-fg": "#121110",
    "--border": "#352f28",
    "--sidebar-bg": "#171512",
    "--sidebar-border": "#2c2721",
    "--shadow-card": "0 2px 10px rgba(0, 0, 0, 0.35)",
    "--shadow-hover": "0 8px 28px rgba(0, 0, 0, 0.55)",
    "color-scheme": "dark",
  },
};

export function applyThemeTokens(mode) {
  const selectedMode = mode === 'dark' ? 'dark' : 'light';
  const tokens = THEME_TOKENS[selectedMode] || THEME_TOKENS.light;
  const root = document.documentElement;
  root.setAttribute('data-theme', selectedMode);
  root.style.colorScheme = selectedMode;
  Object.entries(tokens).forEach(([key, value]) => {
    if (key.startsWith('--')) {
      root.style.setProperty(key, value);
    }
  });
}

export const UIProvider = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem("teamforge.theme") || "light";
    } catch {
      return "light";
    }
  });

  const setTheme = (mode) => {
    const selectedMode = mode === "dark" ? "dark" : "light";
    setThemeState(selectedMode);
    try {
      localStorage.setItem("teamforge.theme", selectedMode);
    } catch {
      // ignore local storage errors
    }
    applyThemeTokens(selectedMode);
  };

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  useEffect(() => {
    applyThemeTokens(theme);
  }, [theme]);

  return (
    <UIContext.Provider value={{ isSidebarOpen, toggleSidebar, theme, setTheme, toggleTheme }}>
      {children}
    </UIContext.Provider>
  );
};
