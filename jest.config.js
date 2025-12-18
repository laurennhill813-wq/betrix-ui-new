export default {
  testEnvironment: "node",
  transform: {},
  // Ignore files that are intended to be run with Node's built-in test runner (node:test)
  testPathIgnorePatterns: [
    "/node_modules/",
    "/tests/.*node-test.*\\.js$",
    "/tests/.*\\.node\\.test\\.js$",
    "/tests/.*\\.ntest\\.js$",
    "/tests/.*comprehensive-integration\\.test\\.js$",
    "/tests/.*v3-handlers\\.test\\.js$",
  ],
};
