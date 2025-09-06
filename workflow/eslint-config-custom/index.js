const rules = require("./rules");
const { resolve } = require("path");

const project = resolve(process.cwd(), 'tsconfig.json')
module.exports = {
  env: {
    browser: true,
    node: true,
    es2021: true
  },
  extends: [
    'standard', // 只用 JS 标准风格
    'plugin:@typescript-eslint/recommended', // TS 推荐规则
  ],
  plugins: ['@typescript-eslint'],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project
  },
  rules: {
    ...rules
  }
}
