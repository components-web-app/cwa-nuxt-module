import ApiError from '../../inc/api-error'

export default {
  data () {
    return {
      requestError: null,
      apiBusy: false
    }
  },
  methods: {
    startApiRequest () {
      this.apiBusy = true
      this.requestError = null
      this.destroyContextMenu()
    },
    completeApiRequest () {
      this.$nextTick(() => {
        this.initContextmenu()
        this.apiBusy = false
      })
    },
    handleApiError (error) {
      if (error instanceof ApiError) {
        this.requestError = error.message
        return
      }
      throw error
    }
  }
}
