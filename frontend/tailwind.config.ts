import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      colors: {
        base: {
          50: "#f6f3ee",
          100: "#efe7dd",
          200: "#e1d4c2",
          300: "#cbb79d",
          400: "#b49676",
          500: "#9b7854",
          600: "#7c5e41",
          700: "#5c4431",
          800: "#3f2e22",
          900: "#281d16",
        },
        accent: {
          400: "#f59e0b",
          500: "#d97706",
          600: "#b45309",
        },
        ink: {
          900: "#131210",
          700: "#2f2a24",
          500: "#51473d",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(245, 158, 11, 0.3), 0 12px 30px -18px rgba(245, 158, 11, 0.9)",
      },
      backgroundImage: {
        "grain": "radial-gradient(circle at 1px 1px, rgba(17, 14, 10, 0.15) 1px, transparent 0)",
      },
    },
  },
  plugins: [],
};

export default config;
