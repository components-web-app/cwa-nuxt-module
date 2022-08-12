import Vue from 'vue'
import { NotificationEvent } from '../../components/cwa-api-notifications/types'
import {
  ConfirmDialogEvent,
  CONFIRM_DIALOG_EVENTS,
  NOTIFICATION_EVENTS
} from '../../../events'
import ApiErrorNotificationsMixin from '../../../mixins/ApiErrorNotificationsMixin'

export const notificationCategories = {
  violations: 'iri-modal.violations'
}

export default Vue.extend({
  mixins: [ApiErrorNotificationsMixin],
  data() {
    return {
      iri: null,
      component: {
        reference: ''
      },
      isLoading: true,
      notificationCategories,
      notifications: {}
    } as {
      iri: string
      component: any
      isLoading: boolean
      notificationCategories: {
        violations: string
      }
      notifications: { [key: string]: NotificationEvent[] }
    }
  },
  computed: {
    isNew() {
      return this.iri === 'add'
    },
    isSaved() {
      return (
        this.isNew ||
        this.$cwa.isResourceSame(this.component, this.savedComponent)
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
        showLoader: this.isLoading
      }
    },
    uiClassNamesString() {
      return this.getClassNamesString(this.component?.uiClassNames)
    },
    savedComponent: {
      get() {
        if (!this.iri) {
          return {}
        }
        const obj = this.$cwa.getResource(this.iri)
        return Object.assign({}, obj, {
          uiClassNames: this.getClassNamesString(obj?.uiClassNames)
        })
      },
      set(newResource) {
        this.$cwa.saveResource(newResource)
      }
    }
  },
  watch: {
    iri() {
      this.findIriResource()
    },
    isSaved(newValue) {
      this.$emit('is-saved', newValue)
    }
  },
  async mounted() {
    this.$cwa.$eventBus.$on(
      NOTIFICATION_EVENTS.add,
      this.handleNotificationEvent
    )
    if (this.isNew || !this.iri) {
      this.isLoading = false
      return
    }
    await this.findIriResource()
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off(
      NOTIFICATION_EVENTS.add,
      this.handleNotificationEvent
    )
  },
  methods: {
    handleNotificationEvent(notification: NotificationEvent) {
      const listenCategories = Object.values(this.notificationCategories)
      if (!listenCategories.includes(notification.category)) {
        return
      }
      const fieldNotifications = this.notifications[notification.field] || []
      fieldNotifications.push(notification)
      this.$set(this.notifications, notification.field, fieldNotifications)
    },
    getClassNamesString(classNamesArray) {
      if (!classNamesArray) {
        return ''
      }
      if (!Array.isArray(classNamesArray)) {
        return classNamesArray
      }
      return classNamesArray.join(', ')
    },
    async findIriResource() {
      if (this.isNew || !this.iri) {
        this.isLoading = false
        this.component = {}
        return
      }
      this.isLoading = true
      const iriResource = await this.$cwa.findResource(this.iri)
      this.component = Object.assign({}, iriResource)
      this.$set(this.component, 'uiClassNames', this.uiClassNamesString)
      this.isLoading = false
    },
    async sendRequest(data, submitEventParams) {
      this.notifications = {}
      this.isLoading = true
      let endpoint = null
      try {
        if (this.isNew) {
          if (!this.postEndpoint) {
            throw new Error(
              'You should use IriPageMixin or extend IriModalMixin to include the postEndpoint variable to create a new resource'
            )
          }
          endpoint = this.postEndpoint
          const newRoute = await this.$cwa.createResource(endpoint, data)
          this.iri = newRoute['@id']
        } else {
          endpoint = this.iri
          await this.$cwa.updateResource(endpoint, data)
        }
        if (!submitEventParams?.cancelClose) {
          this.$emit('change')
        } else {
          this.$emit('reload')
          await this.findIriResource()
        }
        const successFn = submitEventParams?.successFn
        if (submitEventParams?.successFn) {
          await successFn(this.iri)
        }
        return true
      } catch (error) {
        this.handleResourceRequestError(error, endpoint)
        return false
      } finally {
        this.isLoading = false
      }
    },
    // processViolations(violations) {
    //   violations.forEach((violation: Violation) => {
    //     const notification: NotificationEvent = {
    //       code: violation.propertyPath,
    //       title: violation.propertyPath,
    //       message: violation.message,
    //       level: NotificationLevels.ERROR,
    //       category: this.notificationCategories.violations
    //     }
    //     this.$cwa.$eventBus.$emit(NOTIFICATION_EVENTS.add, notification)
    //     const fieldNotifications =
    //       this.notifications[violation.propertyPath] || []
    //     fieldNotifications.push(notification)
    //     this.notifications[violation.propertyPath] = fieldNotifications
    //   })
    // },
    deleteComponent(fn: Function = null) {
      const event: ConfirmDialogEvent = {
        id: 'confirm-delete-resource',
        title: 'Confirm Delete',
        html: `<p>Are you sure you want to delete this resource?</p><p class="warning"><span class="cwa-icon"><span class="cwa-warning-triangle"></span></span><span>This action cannot be reversed!</span></p>`,
        onSuccess: async () => {
          this.isLoading = true
          await this.$cwa.deleteResource(this.iri)
          this.$emit('change')
          if (fn) {
            await fn()
          }
          this.isLoading = false
        },
        confirmButtonText: 'Delete'
      }
      this.$cwa.$eventBus.$emit(CONFIRM_DIALOG_EVENTS.confirm, event)
    }
  }
})
