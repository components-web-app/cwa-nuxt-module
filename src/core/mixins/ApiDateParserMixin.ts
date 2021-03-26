import Vue from 'vue'
import moment from 'moment'

export default Vue.extend({
  methods: {
    parseDateString(string) {
      return moment.utc(string).toDate()
    },
    parseDateToLocal(string) {
      return moment(this.parseDateString(string)).local()
    },
    formatDate(date, format = 'DD/MM/YY @ HH:mm') {
      return moment(date).format(format)
    }
  }
})
