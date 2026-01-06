import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: [
      "node_modules/**",
      "snap-apps-server/**", // Separate Next.js project
      "dist/**",
      "*.js", // Don't lint the eslint config itself
    ],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      // TypeScript rules
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off", // Allow any for this project
      "@typescript-eslint/explicit-function-return-type": "off",

      // General rules
      "no-console": "off", // Allow console for this bot
      "prefer-const": "warn",
      "no-var": "error",
    },
  },
];
