import Vue from 'vue'

export default Vue.extend({
  auth: false,
  cwa: false,
  layout: 'cwa-default',
  watch: {
    '$auth.user'(newUser) {
      if (newUser === false) {
        this.$router.push(`/`)
      }
    }
  },
  async mounted() {
    // has to be on mounted as needs to be checked client-side
    if (!this.$cwa.isAdmin) {
      // this is so any components on the page that may be changing the URL eg remove
      // the search filters that will be doing this for a list
      await this.$destroy(this.$root)
      // now we have no interference - we redirect.
      await this.$router.push('/login')
      return
    }
    this.$cwa.$eventBus.$emit('cwa:admin-bar:change-view', 'admin')
  }
})
