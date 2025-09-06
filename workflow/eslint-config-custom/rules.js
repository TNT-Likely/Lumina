module.exports = {
  "indent": ["error", 2],
  "linebreak-style": ["error", "unix"],
  "quotes": ["error", "single"],
  "semi": ["error", "never"],
  "space-before-blocks": ["error", "always"],
  "keyword-spacing": ["error"],
  "space-infix-ops": ["error", { "int32Hint": false }],
  "object-curly-spacing": ["error", "always"],

  // 关闭为使用变量的提示
  "@typescript-eslint/no-unused-vars": 0,
  "no-unused-vars": 0,

  // 关闭强制使用??运算符
  "@typescript-eslint/prefer-nullish-coalescing": 0,

  //关闭函数强制返回类型
  "@typescript-eslint/explicit-function-return-type":0,

  // 关闭在void事件中写promise<void>
  "@typescript-eslint/no-misused-promises": 0,

  "@typescript-eslint/no-duplicate-enum-values": 0,
  "@typescript-eslint/no-empty-object-type": 0,



  //---------警告 ⚠️  逐步替换---------------------

  // any先改为警告⚠️ 逐步替换
  // "@typescript-eslint/no-explicit-any": ['warn'],

  // 在定义之前使用改为⚠️ 逐步替换
  "no-use-before-define": 1,

  // 空函数 ⚠️
  "@typescript-eslint/no-empty-function": 1,
};
