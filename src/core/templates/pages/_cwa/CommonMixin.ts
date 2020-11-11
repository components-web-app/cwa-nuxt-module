import Vue from 'vue'

export default Vue.extend({
  auth: false,
  cwa: false,
  layout: 'cwa-default',
  middleware({ $cwa, redirect }) {
    if (process.client && !$cwa.isAdmin) {
      return redirect('/login')
    }
  }
})
