<template>
  <div>
    test is: '{{ asyncDataOutput }}'
    <div>
      <component-collection location="primary" :page-id="iri" />
    </div>
    <div>
      <component-collection location="secondary" :page-id="iri" />
    </div>
  </div>
</template>

<script>
import PageMixin from "@cwa/nuxt-module/core/mixins/PageMixin.js"

export default {
  mixins: [PageMixin],
  data() {
    return {
      asyncDataOutput: 'asyncData NOT loaded'
    }
  },
  computed: {
    test() {
      return this.$cwa.$storage.getState('pageTemplateState')
    }
  },
  async beforeCreate() {
    this.asyncDataOutput = await this.$axios.get('/_/routes')
  }
}
</script>
