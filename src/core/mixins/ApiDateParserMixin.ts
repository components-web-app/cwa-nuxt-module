import Vue from 'vue'

export default Vue.extend({
  data() {
    return {
      moment: null
    }
  },
  mounted() {
    import('moment').then((moment) => {
      this.moment = moment
    })
  },
  methods: {
    parseDateString(string) {
      if (!this.moment) {
        return string
      }
      return this.moment.utc(string).toDate()
    },
    parseDateToLocal(string) {
      if (!this.moment) {
        return string
      }
      return this.moment(this.parseDateString(string)).local()
    },
    parseLocalDateToUtc(string) {
      if (!this.moment) {
        return string
      }
      return this.moment(string).utc()
    },
    formatDate(date, format = 'DD/MM/YY @ HH:mm') {
      if (!this.moment) {
        return date
      }
      return this.moment(date).format(format)
    }
  }
})
