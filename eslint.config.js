export default [
  {
    // ignore node_modules and CI artifacts
    ignores: [
      "node_modules/**",
      "ci-logs/**",
      "archive/**",
      ".local/**",
      ".snapshots/**",
      ".history/**",
      ".git_tmp_patch/**",
    ],
  },
  {
    // Target source, scripts, tests and server code only to avoid historical/archival artifacts
    files: [
      "src/**/*.js",
      "server/**/*.js",
      "scripts/**/*.js",
      "tests/**/*.js",
      "bin/**/*.js",
      "*.js",
    ],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
    },
    plugins: [{ name: "import" }],
    // Note: `env` is not accepted in flat config schema; rely on languageOptions above.
    rules: {
      // Disable some import/* rules that cause failures in mixed artifact files
      "import/no-named-as-default-member": "off",
      "import/named": "off",
      "import/no-named-as-default": "off",
      // keep default rules — explicit rules can be added later
    },
  },
];
