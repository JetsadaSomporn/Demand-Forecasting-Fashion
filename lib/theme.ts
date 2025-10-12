export type ThemeMode = "dark" | "light";

export const themeModes: ThemeMode[] = ["dark", "light"];

export const palette = {
  background: "#04040a",
  surface: "rgba(255, 255, 255, 0.08)",
  surfaceHover: "rgba(255, 255, 255, 0.12)",
  border: "rgba(255, 255, 255, 0.18)",
  foreground: "#f5f5f7",
  muted: "rgba(229, 231, 235, 0.7)",
  accent: "#7c8cff",
  accentMuted: "rgba(124, 140, 255, 0.18)",
};

export const cardClassName =
  "rounded-[28px] border border-white/10 bg-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl";

export const subtleTextClassName = "text-sm leading-relaxed text-white/60";

export const headingClassName =
  "font-display text-[clamp(1.5rem,2.5vw,2.25rem)] tracking-[0.18em] uppercase text-white";
