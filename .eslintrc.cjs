/**
 * ESLint Configuration for MCP FileBridge
 *
 * Enterprise-grade linting rules for TypeScript/JavaScript code quality,
 * maintainability, and consistency. Follows industry best practices.
 *
 * @author aezizhu
 * @version 1.0.0
 */

module.exports = {
  // Use the latest ECMAScript features and TypeScript parser
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },

  // Enable ES6+ features and Node.js environment
  env: {
    node: true,
    es2022: true,
    jest: true,
  },

  // Extend recommended configurations (simplified for initial setup)
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier', // Must be last to override other formatting rules
  ],

  // Additional plugins for enhanced code quality
  plugins: [
    '@typescript-eslint',
  ],

  // Custom rules for enterprise-grade code quality (simplified for initial setup)
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      ignoreRestSiblings: true,
    }],
    '@typescript-eslint/no-explicit-any': 'error',

    // General code quality rules
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-duplicate-imports': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
  },

  // Ignore patterns
  ignorePatterns: [
    'dist/',
    'build/',
    'node_modules/',
    'coverage/',
    '*.d.ts',
    '*.js.map',
    '*.ts.map',
  ],
};
