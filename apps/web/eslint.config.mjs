import nextConfig from "eslint-config-next";
import react from "eslint-plugin-react";

// Next 16 ships a flat-config-friendly preset already. Add a small override to
// tone down some of the new React 19 hook/compiler rules that are noisy in the
// existing codebase.
const overrides = {
  plugins: { react },
  rules: {
    "react-hooks/set-state-in-effect": "off",
    "react-hooks/preserve-manual-memoization": "off",
    "react-hooks/refs": "off",
    "react-hooks/purity": "off",
    "react-hooks/immutability": "off",
    "react-hooks/exhaustive-deps": "off",
    "eslint-comments/no-unused-disable": "off",
    "@next/next/no-img-element": "off",
    "react/display-name": "off",
    "react/no-unescaped-entities": "warn",
  },
};

const config = [...nextConfig, overrides];

export default config;
