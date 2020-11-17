import Vue from 'vue'

export default Vue.extend({
  auth: false,
  cwa: false,
  layout: 'cwa-default',
  async mounted() {
    // has to be on mounted as needs to be checked client-side
    if (!this.$cwa.isAdmin) {
      // this is so any components on the page that may be changing the URL re removed
      // the grid page filters will be doing this
      await this.$destroy(this.$root)
      // now we have no interference - we redirect.
      await this.$router.push('/login')
    }
  }
})
