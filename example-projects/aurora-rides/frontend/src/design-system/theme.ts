type ThemeSection = Record<string, string | number>;

const createCssVariables = (sectionPrefix: string, tokens: ThemeSection) => {
  return Object.entries(tokens).reduce<Record<string, string>>((acc, [token, value]) => {
    acc[`--aurora-${sectionPrefix}-${token.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`] =
      typeof value === "number" ? `${value}` : value;
    return acc;
  }, {});
};

export const auroraTheme = {
  colors: {
    background: "#040915",
    surface: "#0b1730",
    surfaceAlt: "#132649",
    surfaceMuted: "rgba(19, 38, 73, 0.6)",
    accent: "#5eead4",
    accentAlt: "#3b82f6",
    accentMuted: "rgba(94, 234, 212, 0.2)",
    textPrimary: "#f8fafc",
    textSecondary: "rgba(248, 250, 252, 0.68)",
    textFaint: "rgba(248, 250, 252, 0.44)",
    border: "rgba(148, 163, 184, 0.2)",
    danger: "#f97070",
    warning: "#facc15",
    success: "#34d399",
    info: "#38bdf8"
  },
  spacing: {
    "2xs": "0.25rem",
    xs: "0.5rem",
    sm: "0.75rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "3rem"
  },
  radii: {
    xs: "6px",
    sm: "10px",
    md: "16px",
    lg: "22px",
    pill: "9999px"
  },
  typography: {
    familyHeading: "'Inter Tight', 'Inter', system-ui, sans-serif",
    familyBody: "'Inter', system-ui, sans-serif",
    familyMono: "'JetBrains Mono', monospace",
    sizeXs: "0.75rem",
    sizeSm: "0.875rem",
    sizeMd: "1rem",
    sizeLg: "1.25rem",
    sizeXl: "1.75rem",
    weightLight: 300,
    weightRegular: 400,
    weightMedium: 500,
    weightSemibold: 600,
    weightBold: 700,
    lineHeightTight: 1.15,
    lineHeightRegular: 1.5,
    lineHeightRelaxed: 1.75
  },
  shadows: {
    soft: "0 16px 40px rgba(15, 23, 42, 0.25)",
    focus: "0 0 0 3px rgba(94, 234, 212, 0.35)",
    glow: "0 0 24px rgba(94, 234, 212, 0.45)"
  },
  gradients: {
    hero: "linear-gradient(135deg, rgba(94, 234, 212, 0.18) 0%, rgba(59, 130, 246, 0.18) 100%)",
    card: "linear-gradient(145deg, rgba(20, 31, 66, 0.92) 0%, rgba(14, 22, 44, 0.92) 60%, rgba(12, 21, 40, 0.92) 100%)"
  },
  transitions: {
    default: "150ms ease",
    slow: "250ms ease-in-out"
  }
} as const;

export type AuroraTheme = typeof auroraTheme;

export const auroraThemeVariables = {
  ...createCssVariables("color", auroraTheme.colors),
  ...createCssVariables("space", auroraTheme.spacing),
  ...createCssVariables("radius", auroraTheme.radii),
  ...createCssVariables("type", auroraTheme.typography),
  ...createCssVariables("shadow", auroraTheme.shadows),
  ...createCssVariables("gradient", auroraTheme.gradients),
  ...createCssVariables("transition", auroraTheme.transitions)
};

export const applyAuroraTheme = (target: HTMLElement = document.documentElement) => {
  if (typeof document === "undefined") return;
  Object.entries(auroraThemeVariables).forEach(([key, value]) => {
    target.style.setProperty(key, value);
  });
};

