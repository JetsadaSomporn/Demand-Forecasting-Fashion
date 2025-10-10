import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        "surface-hover": "var(--surface-hover)",
        border: "var(--border)",
        foreground: "var(--foreground)",
        "foreground-muted": "var(--foreground-muted)",
        accent: "var(--accent)",
        "accent-alt": "var(--accent-alt)",
      },
      fontFamily: {
        sans: ["var(--font-montserrat)", "Montserrat", "system-ui", "sans-serif"],
        display: ["var(--font-montserrat-display)", "Montserrat", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "xl": "1.25rem",
      },
      boxShadow: {
        card: "0 20px 40px rgba(8,8,12,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
