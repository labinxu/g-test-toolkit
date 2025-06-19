import type { Config } from "tailwindcss";

export default {
    theme: {
        extend: {},
    },

    content: ["src/**/*.{js,ts,jsx,tsx,mdx}","src/**/**/*.{js,ts,jsx,tsx,mdx}"],
    plugins: [],
} satisfies Config;
