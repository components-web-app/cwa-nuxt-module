<template>
  <div>
    <slot :viewData="{ repeatedChildren: formView.children }"></slot>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import FormViewBlockMixin from '@cwa/nuxt-module/core/mixins/FormViewBlockMixin'

export default Vue.extend({
  mixins: [FormViewBlockMixin],
  computed: {}
})
</script>
