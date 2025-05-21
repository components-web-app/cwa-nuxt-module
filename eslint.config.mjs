import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

const flatConfigComposer = createConfigForNuxt({
  features: {
    stylistic: true,
  },
})

// flatConfigComposer.then((config) => {
//   console.error(config)
// })

flatConfigComposer.prepend({
  ignores: ['dist', 'node_modules', '**/*.spec.ts'],
  files: [
    'src/runtime/templates/components/**/*.vue',
    'playground/cwa/**/*.vue',
    'src/layer/**/*.vue',
    '**/*.ts',
    '**/*.js',
    '**/*.vue',
  ],
})

flatConfigComposer.override('nuxt/vue/rules', {
  rules: {
    'vue/multi-word-component-names': 'off',
    'vue/no-multiple-template-root': 'off',
    'vue/html-comment-content-spacing': [
      'error',
      'always',
      { exceptions: ['cwa-start', 'cwa-end'] },
    ],
  },
})

flatConfigComposer.override('nuxt/typescript/rules', {
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      ignoreRestSiblings: true,
      varsIgnorePattern: '^_',
      caughtErrors: 'none',
    }],
    '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/no-dynamic-delete': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
  },
})

export default flatConfigComposer
