/**
 * 根级 ESLint 配置
 * - 默认使用自定义通用配置（workflow/eslint-config-custom）
 * - 对 React/TSX 文件应用 React 增强配置
 */
module.exports = {
  root: true,
  extends: [
    "./workflow/eslint-config-custom"
  ],
  overrides: [
  ],
  ignorePatterns: [
    "**/node_modules/**",
    "**/dist/**",
    "**/.turbo/**",
    "**/coverage/**",
    "dev/**/data/**",
    "dev/**/logs/**",
    "mysql-backup.sql"
  ]
}
