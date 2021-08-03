<template>
  <div>
    Form
    <pre>{{ resource }}</pre>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import ComponentMixin from '@cwa/nuxt-module/core/mixins/ComponentMixin'

export default Vue.extend({
  mixins: [ComponentMixin]
})
</script>
