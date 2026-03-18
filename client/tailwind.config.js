/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        midnight: "#0b0f1c",
        navy: "#0e1a2b",
        slate: "#111f36",
        panel: "rgba(15, 23, 42, 0.92)",
        accent: "#24f1c8",
        accentSoft: "rgba(36, 241, 200, 0.15)",
        muted: "#9aa6c4",
        ink: "#f5f7ff"
      },
      boxShadow: {
        glow: "0 0 30px rgba(36, 241, 200, 0.35)",
        panel: "0 25px 60px rgba(6, 10, 20, 0.55)"
      },
      fontFamily: {
        display: ["Roboto", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-in": "fade-in 0.8s ease-out",
        "slide-up": "slide-up 0.8s ease-out"
      }
    }
  },
  plugins: []
};
