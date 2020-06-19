<template>
  <div>
    <div>
      <component-collection location="primary" :page-id="iri" />
    </div>
    <div>
      <component-collection location="secondary" :page-id="iri" />
    </div>
  </div>
</template>

<script>
import PageMixin from '@cwa/nuxt-module/core/mixins/PageMixin'

export default {
  mixins: [PageMixin],
  data () {
    return {
      asyncDataOutput: 'asyncData NOT loaded'
    }
  },
  computed: {
    test () {
      return this.$cwa.$storage.getState('pageTemplateState')
    }
  },
  // middleware or asyncData type functionality desired for the user to be able to create these pages nicely.
  // this will not create ssr data
  async beforeCreate () {
    this.asyncDataOutput = await this.$axios.get(process.client ? process.env.API_URL_BROWSER : process.env.API_URL + '/_/routes')
  }
}
</script>
