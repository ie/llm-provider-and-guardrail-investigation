import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    { ignores: ['dist', 'node_modules'] },
    {
        files: ['**/*.{js,jsx}'],
        extends: [js.configs.recommended],
        languageOptions: {
            ecmaVersion: 2022,
            parserOptions: { ecmaFeatures: { jsx: true } },
            globals: globals.browser,
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': 'warn',
        },
    },
    {
        files: ['scripts/**/*.ts'],
        extends: [tseslint.configs.recommended],
        languageOptions: {
            globals: globals.node,
        },
    },
    {
        files: ['api/**/*.js', 'vite.config.js'],
        languageOptions: {
            globals: globals.node,
        },
    },
)
