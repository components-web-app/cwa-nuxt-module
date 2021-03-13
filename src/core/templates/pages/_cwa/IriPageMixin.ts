import Vue from 'vue'
import CommonMixin from "./CommonMixin";
import IriModalView from "../../components/iri-modal-view.vue";
import {
  Notification,
  NotificationEvents,
  NotificationLevels,
  RemoveNotificationEvent
} from "../../components/cwa-api-notifications/types";
import ApiRequestError from "../../../../inc/api-error";
import {Violation} from "../../../../utils/AxiosErrorParser"

export const notificationCategories = {
  violations: 'iri-modal.violations'
}

export default (postEndpoint: string) => Vue.extend({
  mixins: [CommonMixin],
  components: { IriModalView },
  data() {
    return {
      iri: decodeURIComponent(this.$route.params.iri),
      component: {
        reference: this.$route.query.reference || ''
      },
      savedComponent: {},
      isLoading: true,
      notificationCategories,
      notifications: {}
    } as {
      iri: string,
      component: any,
      savedComponent: any,
      isLoading: boolean,
      notificationCategories: {
        violations: string
      },
      notifications: {[key: string]: Notification[]}
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
  computed: {
    isNew() {
      return this.$route.params.iri === 'add'
    },
    isSaved() {
      return JSON.stringify(this.component) ===  JSON.stringify(this.savedComponent)
    },
    inputProps() {
      return key => ({
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
  methods: {
    async sendRequest(data) {
      this.notifications = {}
      this.isLoading = true
      try {
        if (this.isNew) {
          await this.$cwa.createResource(postEndpoint, data)
        } else {
          await this.$cwa.updateResource(this.iri, data)
        }
        this.$emit('change')
      } catch (error) {
        if (!(error instanceof ApiRequestError)) {
          throw error
        }
        if (error.violations) {
          this.processViolations(error.violations)
        }

        if (error.statusCode === 500) {
          const notification: Notification = {
            code: 'server_error',
            title: 'An error occurred',
            message: error.message,
            level: NotificationLevels.ERROR,
            category: this.notificationCategories.violations
          }
          this.$cwa.$eventBus.$emit(NotificationEvents.add, notification)
        }

      }

      this.isLoading = false
    },
    processViolations(violations) {
      violations.forEach((violation: Violation) => {
        const notification: Notification = {
          code: violation.propertyPath,
          title: violation.propertyPath,
          message: violation.message,
          level: NotificationLevels.ERROR,
          category: this.notificationCategories.violations
        }
        this.$cwa.$eventBus.$emit(NotificationEvents.add, notification)
        const fieldNotifications = this.notifications[violation.propertyPath] || []
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
