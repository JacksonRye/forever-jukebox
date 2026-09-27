export type ThemeName = "light" | "dark";

const themeStorageKey = "fj-theme";

const themeConfig: Record<ThemeName, Record<string, string>> = {
  dark: {
    "--bg": "#000000",
    "--text": "#FFFFFF",
    "--text-rgb": "255, 255, 255",
    "--muted": "#8F94A0",
    "--accent": "#FFFFFF",
    "--title-accent": "#FFFFFF",
    "--title-glow": "transparent",
    "--scrim": "rgba(0, 0, 0, 0.85)",
    "--shadow-elevated": "rgba(0, 0, 0, 0.7)",
    "--danger": "#E35A5A",
    "--surface-panel": "#131417",
    "--surface-hero": "#000000",
    "--surface-control": "#181A1F",
    "--surface-control-hover": "#23252C",
    "--border-panel": "rgba(255, 255, 255, 0.08)",
    "--border-hero": "rgba(255, 255, 255, 0.08)",
    "--border-control": "rgba(255, 255, 255, 0.18)",
    "--viz-bg":
      "radial-gradient(circle closest-side at 50% 50%, #131417 0%, #000000 100%)",
    "--viz-shadow": "rgba(255, 255, 255, 0.06)",
    "--viz-overlay": "rgba(0, 0, 0, 0.8)",
    "--edge-stroke": "rgba(255, 255, 255, 0.35)",
    "--edge-selected": "#FFFFFF",
    "--beat-fill": "#FFFFFF",
    "--beat-highlight": "#FFFFFF",
  },
  light: {
    "--bg": "#F6F1FF",
    "--text": "#261A38",
    "--text-rgb": "38, 26, 56",
    "--muted": "#635280",
    "--accent": "#2E8BFF",
    "--title-accent": "#B144FF",
    "--title-glow": "rgba(177, 68, 255, 0.34)",
    "--scrim": "rgba(38, 26, 56, 0.42)",
    "--shadow-elevated": "rgba(38, 26, 56, 0.22)",
    "--danger": "#B3261E",
    "--surface-panel": "#FCFAFF",
    "--surface-hero": "#EFE5FF",
    "--surface-control": "#E8DBFF",
    "--surface-control-hover": "#DDCCFF",
    "--border-panel": "rgba(73, 43, 113, 0.20)",
    "--border-hero": "rgba(91, 48, 150, 0.26)",
    "--border-control": "rgba(96, 56, 152, 0.34)",
    "--viz-bg":
      "radial-gradient(circle closest-side at 50% 50%, #D9C3FF 0%, #F6F1FF 100%)",
    "--viz-shadow": "rgba(101, 52, 168, 0.24)",
    "--viz-overlay": "rgba(250, 246, 255, 0.74)",
    "--edge-stroke": "rgba(77, 48, 120, 0.44)",
    "--edge-selected": "#7F39FB",
    "--beat-fill": "#B144FF",
    "--beat-highlight": "#B144FF",
  },
};

export function resolveStoredTheme(): ThemeName {
  try {
    return localStorage.getItem(themeStorageKey) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: ThemeName) {
  const root = document.documentElement;
  Object.entries(themeConfig[theme]).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  root.style.colorScheme = theme;
  try {
    localStorage.setItem(themeStorageKey, theme);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function applyStoredTheme() {
  applyTheme(resolveStoredTheme());
}
