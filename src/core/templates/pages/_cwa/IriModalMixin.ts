import Vue from 'vue'
import {
  NotificationEvent,
  NotificationLevels
} from '../../components/cwa-api-notifications/types'
import ApiError from '../../../../inc/api-error'
import { NOTIFICATION_EVENTS } from '../../../events'
import { Violation } from '../../../../utils/AxiosErrorParser'

export const notificationCategories = {
  violations: 'iri-modal.violations'
}

export default Vue.extend({
  data() {
    return {
      iri: null,
      component: {
        reference: ''
      },
      savedComponent: {},
      isLoading: true,
      notificationCategories,
      notifications: {}
    } as {
      iri: string
      component: any
      savedComponent: any
      isLoading: boolean
      notificationCategories: {
        violations: string
      }
      notifications: { [key: string]: NotificationEvent[] }
    }
  },
  computed: {
    isNew() {
      return this.$route.params.iri === 'add'
    },
    isSaved() {
      return (
        JSON.stringify(this.component) === JSON.stringify(this.savedComponent)
      )
    },
    inputProps() {
      return (key) => ({
        id: `component-${key}`,
        required: true,
        notifications: this.notifications[key],
        isLoading: this.isLoading
      })
    },
    iriModalProps() {
      return {
        notificationCategories: Object.values(this.notificationCategories),
        isSaved: this.isSaved,
        isNew: this.isNew,
        component: this.component,
        showLoader: this.isLoading
      }
    }
  },
  async mounted() {
    if (this.isNew) {
      this.isLoading = false
      return
    }
    this.component = await this.$axios.$get(this.iri)
    this.component.uiClassNames = this.component?.uiClassNames?.join(', ')
    this.isLoading = false
    this.savedComponent = Object.assign({}, this.component)
  },
  methods: {
    async sendRequest(data) {
      this.notifications = {}
      this.isLoading = true
      try {
        if (this.isNew) {
          if (!this.postEndpoint) {
            throw new Error(
              'You should use IriPageMixin or extend IriModalMixin to include the postEndpoint variable to create a new resource'
            )
          }
          await this.$cwa.createResource(this.postEndpoint, data)
        } else {
          await this.$cwa.updateResource(this.iri, data)
        }
        this.$emit('change')
      } catch (error) {
        if (!(error instanceof ApiError)) {
          throw error
        }
        if (error.violations) {
          this.processViolations(error.violations)
        }

        if (error.statusCode === 500) {
          const notification: NotificationEvent = {
            code: 'server_error',
            title: 'An error occurred',
            message: error.message,
            level: NotificationLevels.ERROR,
            category: this.notificationCategories.violations
          }
          this.$cwa.$eventBus.$emit(NOTIFICATION_EVENTS.add, notification)
        }
      }

      this.isLoading = false
    },
    processViolations(violations) {
      violations.forEach((violation: Violation) => {
        const notification: NotificationEvent = {
          code: violation.propertyPath,
          title: violation.propertyPath,
          message: violation.message,
          level: NotificationLevels.ERROR,
          category: this.notificationCategories.violations
        }
        this.$cwa.$eventBus.$emit(NOTIFICATION_EVENTS.add, notification)
        const fieldNotifications =
          this.notifications[violation.propertyPath] || []
        fieldNotifications.push(notification)
        this.notifications[violation.propertyPath] = fieldNotifications
      })
    },
    async deleteComponent() {
      this.isLoading = true
      await this.$cwa.deleteResource(this.iri)
      this.$emit('change')
      this.isLoading = false
    }
  }
})
