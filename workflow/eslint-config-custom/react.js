const rules = require('./rules')
const {resolve} = require("path");

const project = resolve(process.cwd(), 'tsconfig.json')

module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  extends: [
    'plugin:react/recommended',
    'standard-with-typescript'
  ],
  plugins: [
    'react'
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  rules: {
    ...rules,
    'react/react-in-jsx-scope': 'off',
    'react/jsx-uses-react': 'off',
    'react/jsx-uses-vars': 'off'
  }
}
