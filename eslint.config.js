// ESLint flat config for all TypeScript of the repository (based on xWriter's web/eslint.config.js):
// typescript-eslint strictTypeChecked with type information from the tsconfig projects, the
// React hooks and fast refresh rules for the browser code, and the layout rules of
// docs/plan/02-architecture.md section 2 (which package may import which).
import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '.dev/',
    '.tools/',
    // On main, the agents' worktrees live in .claude/worktrees/.
    '.claude/',
    // Generated files are never edited by hand.
    'apps/web/src/routeTree.gen.ts',
  ]),

  {
    files: ['**/*.{js,ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // strictTypeChecked already forbids `any` (no-explicit-any and the no-unsafe-* rules)
      // and non-null assertions (no-non-null-assertion).
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Render content as React elements; dangerouslySetInnerHTML is not allowed.',
        },
      ],
    },
  },

  {
    files: ['apps/web/src/**/*.{ts,tsx}', 'packages/preview/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
    languageOptions: {
      globals: globals.browser,
    },
  },

  {
    files: ['*.config.js', 'apps/*/*.config.ts', 'apps/server/**/*.ts', 'apps/desktop/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },

  {
    // Route files export only the `Route` object and may define their components locally.
    // The TanStack Router plugin (autoCodeSplitting) moves those components into modules of
    // their own and handles hot reloading for route files, so the rule does not apply here.
    files: ['apps/web/src/routes/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  {
    // The design system copied from xWriter's panel (shadcn/ui on Base UI) exports variant
    // helpers (for example buttonVariants) next to the components, as xWriter allows. That
    // only costs a full reload instead of a hot update while developing, and keeping the
    // files as xWriter has them matters more.
    files: ['apps/web/src/components/ui/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  {
    // packages/* never import from apps/*.
    files: ['packages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@xdesign/web', '@xdesign/server', '**/apps/**'], message: 'packages never import apps.' },
          ],
        },
      ],
    },
  },

  {
    // The design model runs in the browser and in Node: no Node-only or browser-only imports.
    files: ['packages/spec/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@xdesign/web', '@xdesign/server', '**/apps/**'], message: 'packages never import apps.' },
            { group: ['node:*', 'react', 'react-dom', 'react/*', 'react-dom/*'], message: 'spec runs in both.' },
          ],
        },
      ],
    },
  },

  {
    // The web app reaches the server only through packages/api.
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@xdesign/server', '**/apps/server/**'], message: 'Use @xdesign/api.' }] },
      ],
    },
  },

  {
    // The desktop shell reaches the server only through the desktop contract (its environment, its
    // HTTP routes and its exit codes), never through the code of the other packages and apps.
    files: ['apps/desktop/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@xdesign/*', '**/apps/server/**', '**/apps/web/**', '**/packages/**'],
              message: 'The desktop shell talks to the server only through its environment, HTTP and exit codes.',
            },
          ],
        },
      ],
    },
  },
])
