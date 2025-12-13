export default [
  {
    // ignore node_modules and CI artifacts
    ignores: ["node_modules/**", "ci-logs/**"]
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
    },
    env: {
      node: true,
      es2024: true,
    },
    rules: {
      // keep default rules — explicit rules can be added later
    }
  }
];
