import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx,js,jsx,mdx}',
    './src/components/**/*.{ts,tsx,js,jsx,mdx}',
    './src/hooks/**/*.{ts,tsx,js,jsx}',
    './src/lib/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config
