import Vue from 'vue'
import {
  NotificationEvent,
  NotificationLevels
} from '../templates/components/cwa-api-notifications/types'
import ApiError from '../../inc/api-error'
import { API_EVENTS, NOTIFICATION_EVENTS } from '../events'

export default Vue.extend({
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
      const notification: NotificationEvent = {
        code: API_EVENTS.error,
        title: 'API Error',
        message: error.statusCode + ': ' + error.message,
        level: NotificationLevels.ERROR,
        endpoint: error.endpoint
      }
      this.$cwa.$eventBus.$emit(NOTIFICATION_EVENTS.add, notification)
    }
  }
})
