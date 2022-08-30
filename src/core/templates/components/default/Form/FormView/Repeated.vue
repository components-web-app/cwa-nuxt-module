<template>
  <div>
    <slot :view-data="{ repeatedChildren: formView.children }"></slot>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import FormViewBlockMixin from '@cwa/nuxt-module/core/mixins/FormViewBlockMixin'

export default Vue.extend({
  name: 'CwaFormRepeated',
  mixins: [FormViewBlockMixin],
  computed: {}
})
</script>
