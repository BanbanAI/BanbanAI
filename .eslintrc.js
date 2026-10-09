module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  parser: "vue-eslint-parser",
  extends: [
    "eslint:recommended",
    "plugin:vue/vue3-essential",
    "plugin:@typescript-eslint/recommended",
  ],
  parserOptions: {
    ecmaVersion: "latest",
    parser: "@typescript-eslint/parser",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ["vue", "@typescript-eslint"],
  rules: {
    indent: ["error", 2],
    "linebreak-style": "off",
    quotes: "off",
    semi: "off",
    "@typescript-eslint/no-empty-object-type": ["warn"],
  },
  overrides: [
    {
      files: ["*.vue"],
      rules: {
        "no-undef": "off", // ts(2304)
      },
    },
  ],
};
