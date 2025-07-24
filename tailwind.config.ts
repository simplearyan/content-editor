// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Add any specific theme extensions needed for your editor or blog preview
    },
  },
  plugins: [
    require('@tailwindcss/typography'), // <-- Ensure this is present for Markdown styling
  ],
};
export default config;