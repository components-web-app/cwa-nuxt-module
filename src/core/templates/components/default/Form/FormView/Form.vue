<template>
  <form
    :action="vars.action"
    v-bind="vars.attr"
    :class="['cwa-form', { 'is-submitting': metadata.validation.submitting }]"
    @submit.prevent="submitForm"
  >
    <div v-if="metadata.validation.success">Form successfully submitted</div>
    <template v-else>
      <slot></slot>
      <span class="help">* required</span>
    </template>
  </form>
</template>

<script lang="ts">
import Vue from 'vue'
import FormViewBlockMixin from '@cwa/nuxt-module/core/mixins/FormViewBlockMixin'

export default Vue.extend({
  mixins: [FormViewBlockMixin],
  // prevent unnecessary call to initialise this as a form view
  created() {},
  methods: {
    submitForm() {
      this.$cwa.forms.submit(this.storeId)
    }
  }
})
</script>

<style lang="sass">
.cwa-form.is-submitting
  opacity: 0.6
</style>
