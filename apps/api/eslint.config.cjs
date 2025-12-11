// ESLint v9 flat config (CommonJS)
const { FlatCompat } = require('@eslint/eslintrc')
const path = require('path')

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

module.exports = [
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'test/**',
      '**/*.spec.ts',
      '**/*.e2e.ts',
      'cases/**',
      'workspace/**',
      'user-cases/**',
    ],
  },
  ...compat.extends('@repo/eslint-config/nest.js'),
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true }],
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      // 项目已有格式未统一，先关闭 prettier 强制检查，后续可按需开启
      'prettier/prettier': 'off',
      // 环境变量声明与 turbo 配置暂不校验
      'turbo/no-undeclared-env-vars': 'off',
    },
  },
]
