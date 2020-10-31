import Vue from 'vue'

export default Vue.extend({
  auth: false,
  cwa: false,
  layout: 'cwa-default',
  mounted() {
    if (!this.$cwa.isAdmin) {
      this.$router.push('/')
    }
  }
})
