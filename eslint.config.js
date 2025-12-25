// eslint.config.js
const typescriptParser = require('@typescript-eslint/parser');
const typescriptPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
    {
        files: ["src/**/*.ts"],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: 6,
                sourceType: "module"
            }
        },
        plugins: {
            "@typescript-eslint": typescriptPlugin
        },
        rules: {
            "@typescript-eslint/naming-convention": "warn",
            "@typescript-eslint/semi": "warn",
            "curly": "warn",
            "eqeqeq": "warn",
            "no-throw-literal": "warn",
            "semi": "off"
        }
    },
    {
        ignores: ["out/", "dist/", "**/*.d.ts"]
    }
];
