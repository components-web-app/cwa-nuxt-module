import { NotificationEvent, NotificationLevels } from '../templates/cwa-api-notifications/types'
import ApiError from '../../inc/api-error'

export default {
  data () {
    return {
      apiBusy: false
    }
  },
  methods: {
    startApiRequest () {
      this.apiBusy = true
      this.destroyContextMenu()
    },
    completeApiRequest () {
      this.$nextTick(() => {
        this.initContextmenu()
        this.apiBusy = false
      })
    },
    handleApiError (error) {
      if (!(error instanceof ApiError)) {
        throw error
      }
      const notification: NotificationEvent = {
        message: error.statusCode + ': ' + error.message,
        level: NotificationLevels.ERROR,
        endpoint: error.endpoint
      }
      this.$root.$emit('cwa-notification', notification)
    }
  }
}
