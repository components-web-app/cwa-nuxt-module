module.exports = {
  extends: [
    '@nuxtjs/eslint-config-typescript',
    'prettier',
    'plugin:cypress/recommended',
    'plugin:prettier/recommended',
    'plugin:nuxt/recommended'
  ],
  rules: {
    'import/no-named-as-default-member': 0,
    'import/no-named-as-default': 0,
    'vue/no-v-html': 0,
    'vue/custom-event-name-casing': [
      'error',
      {
        ignores: [
          '/^cwa:[a-z]+(?:-[a-z]+)*:[a-z]+(?:-[a-z]+)*(:[a-z]+(?:-[a-z]+)*)?$/u'
        ]
      }
    ],
    'vue/multi-word-component-names': 0
  }
}
