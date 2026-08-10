import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#07100c",
        panel: "#0d1913",
        lime: "#b8ff5b",
        mint: "#70e7a8",
      },
      boxShadow: {
        glow: "0 0 60px rgba(184, 255, 91, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
