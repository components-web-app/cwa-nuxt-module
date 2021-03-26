import {
  Notification,
  NotificationLevels
} from '../templates/components/cwa-api-notifications/types'
import ApiError from '../../inc/api-error'

export default {
  data() {
    return {
      apiBusy: false
    }
  },
  methods: {
    startApiRequest() {
      this.apiBusy = true
    },
    completeApiRequest() {
      this.$nextTick(() => {
        this.apiBusy = false
      })
    },
    handleApiError(error) {
      if (!(error instanceof ApiError)) {
        throw error
      }
      const notification: Notification = {
        code: 'cwa:api:error',
        title: 'API Error',
        message: error.statusCode + ': ' + error.message,
        level: NotificationLevels.ERROR,
        endpoint: error.endpoint
      }
      this.$cwa.$eventBus.$emit('cwa:notification:add', notification)
    }
  }
}
