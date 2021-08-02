<template>
  <div>
    Form
    <pre>{{ resource }}</pre>
  </div>
</template>

<script>
import Vue from 'vue'
import ComponentMixin from '@cwa/nuxt-module/core/mixins/ComponentMixin.ts'

export default Vue.extend({
  mixins: [ComponentMixin]
})
</script>
