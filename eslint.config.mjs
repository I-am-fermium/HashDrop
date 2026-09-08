import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import nextVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = defineConfig([
  // Next.js 16 native flat configuration — replaces the legacy
  // .eslintrc.json "extends": ["next/core-web-vitals"].
  ...nextVitals,

  // Preserved from the legacy .eslintrc.json "env": { "jest": true }:
  // jest globals for the test suites and jest setup/config files.
  {
    name: 'hashdrop/jest-globals',
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/setupTests.ts',
      'jest.config.js',
    ],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
  },

  // react-hooks v7 introduced compiler-derived rules that flag pre-existing,
  // intentional patterns in the wallet hooks: hydration-sync effects and
  // connection lifecycle management (set-state-in-effect) and the ref-based
  // wallet registry exposed through useWallet's return value (refs).
  // Restructuring wallet state flow is a behavior-sensitive refactor that is
  // out of scope for this ESLint tooling migration, so ONLY these two new
  // rules are scoped off for the wallet hook files. All other rules —
  // including react-hooks/exhaustive-deps — remain fully enabled.
  {
    name: 'hashdrop/wallet-hooks-legacy-patterns',
    files: ['src/hooks/useWallet.ts', 'src/hooks/useWalletKit.ts'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
    },
  },

  // Global ignores (matches the repository's build/generated output; the same
  // defaults eslint-config-next applies, kept explicit here).
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;