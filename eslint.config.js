// eslint.config.js
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

export default defineConfig([
    js.configs.recommended,
    {
        files: ['**/*.{js,mjs,cjs}'],
        ignores: ['node_modules/**', 'dist/**', 'build/**'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.browser
        },
        plugins: {
            prettier: eslintPluginPrettier
        },
        rules: {
            /*
             * Format & basic style
             */
            semi: ['error', 'always'], // require semicolons
            // eslint-disable-next-line no-magic-numbers
            indent: ['error', 4, { SwitchCase: 1 }], // 4 spaces
            quotes: ['error', 'single', { avoidEscape: true }], // prefer single quotes
            'comma-dangle': ['error', 'never'], // no trailing commas
            'no-trailing-spaces': 'error', // no trailing spaces
            'eol-last': ['error', 'always'], // newline at EOF

            /*
             * Variables & scope
             */
            'no-var': 'error', // disallow var
            'prefer-const': ['error', { destructuring: 'all' }], // prefer const
            'no-global-assign': 'error', // prevent assignment to globals
            'no-implicit-globals': 'error', // prevent implicit globals (browser)
            'no-unused-vars': [
                'warn',
                { vars: 'all', args: 'after-used', ignoreRestSiblings: true, caughtErrors: 'none' }
            ], // warn unused vars

            /*
             * Equality & coercion
             */
            eqeqeq: ['error', 'always'], // enforce strict equality (===)
            'no-implicit-coercion': ['error', { allow: ['!!'] }], // avoid implicit coercion

            /*
             * Functions, purity & side-effects
             */
            'consistent-return': 'error', // functions should consistently return
            'no-else-return': 'error', // avoid else after return
            'no-nested-ternary': 'error', // avoid nested ternary

            /*
             * Complexity & file size
             */
            complexity: ['warn', { max: 15 }],
            'max-lines': ['warn', { max: 1000, skipBlankLines: true, skipComments: true }],

            /*
             * DOM & browser specific
             */
            'no-eval': 'error', // ban eval
            'no-alert': 'warn', // warn on alert/confirm/prompt
            // Block direct use of document.write, mapped via no-restricted-properties:
            'no-restricted-properties': [
                'error',
                {
                    object: 'document',
                    property: 'write',
                    message: 'Avoid using document.write(); use DOM APIs or element.append instead.'
                }
            ],

            /*
             * Imports & modules
             */
            'no-duplicate-imports': 'error', // disallow duplicate imports
            // Encourage ES Modules (use `sourceType: module`)

            /*
             * Magic numbers, logging, todos
             */
            'no-magic-numbers': [
                'warn',
                {
                    ignore: [-1, 0, 1, 2, 45, 90, 180, 360],
                    ignoreArrayIndexes: true,
                    ignoreDefaultValues: true,
                    ignoreClassFieldInitialValues: true,
                    detectObjects: false
                }
            ],
            'no-console': ['warn', { allow: ['warn', 'error', 'info'] }], // only warn/error allowed
            // Track TO-DO / FIX ME using core rule:
            'no-warning-comments': ['warn', { terms: ['todo', 'fixme'], location: 'anywhere' }],

            /*
             * Stylistic preferences (Prettier will override formatting rules)
             */
            'object-curly-spacing': ['error', 'always'],
            'array-bracket-spacing': ['error', 'never'],
            'space-before-function-paren': ['error', 'never'],

            /*
             * Reporting Prettier formatting problems through ESLint
             */
            'prettier/prettier': 'error'
        }
    },

    /*
     * Test files overrides (less strict in tests)
     */
    {
        files: ['**/*.test.js', '**/*.spec.js'],
        languageOptions: {
            globals: {
                describe: 'readonly',
                it: 'readonly',
                expect: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly'
            }
        },
        rules: {
            'no-magic-numbers': 'off',
            'no-console': 'off',
            'no-warning-comments': 'off'
        }
    },

    /*
     * Prettier integration: disable conflicting ESLint rules and apply Prettier config last
     */
    eslintConfigPrettier
]);
