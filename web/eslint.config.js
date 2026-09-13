import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'public']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      /**
       * An exhaustive-deps warning in this codebase is a real bug waiting to
       * happen: the section state machine schedules cancellable timers from
       * effects, and a stale closure there is exactly the A→B→A drift that
       * §5.2 rule 3 exists to prevent.
       */
      'react-hooks/exhaustive-deps': 'error',

      // Unused code should not reach a commit, but an underscore prefix is a
      // legitimate way to mark a deliberately ignored binding.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // verbatimModuleSyntax is on, so type imports must be written as such.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
    },
  },
  {
    /**
     * `src/lib` is a utility layer that happens to export a few tiny
     * presentational helpers (RichText, Icon) next to the pure functions they
     * belong with. Splitting them apart purely to satisfy Fast Refresh would
     * scatter one concept across two files; the cost is a full reload when a
     * lib file changes, which is acceptable.
     */
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    /**
     * A provider and the hook that reads it are one unit: the hook is what
     * enforces "not outside the provider", and a context object exported for a
     * separate hook file to import would let a consumer bypass that check.
     *
     * Listed by name rather than switching the rule off, so the rule still
     * catches an unrelated export sneaking in. Adding a provider means adding
     * its hook here, which is a deliberate speed bump.
     */
    files: ['src/providers/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': [
        'error',
        { allowExportNames: ['useTheme', 'useViewport', 'useSectionNavigation'] },
      ],
    },
  },
  {
    // Tests legitimately reach for non-null assertions and loose typing.
    files: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['vite.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
