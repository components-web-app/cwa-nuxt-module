<template>
  <cwa-modal @close="$emit('close')" class="layout-details-page">
    <div class="status-bar">
      <status-icon :status="saved ? 1 : 0" />
      <error-notifications :listen-categories="[unsavedCategory, violationsCategory]" />
    </div>
    <div>
      <h2>Layout Details</h2>
    </div>
    <section class="details-section">
      <div class="row fields-container">
        <div class="column">
          <cwa-admin-text
            label="Reference"
            v-model="component.reference"
            v-bind="inputProps('reference')"
          />
          <cwa-admin-select
            label="UI Component"
            v-model="component.uiComponent"
            :options="Object.keys($cwa.options.layouts)"
            v-bind="inputProps('uiComponent')"
          />
        </div>
        <div class="column">
          <div class="right-column-aligner">
            <div>
              <cwa-admin-text
                label="Style classes"
                v-model="component.uiClassNames"
                v-bind="inputProps('uiClassNames')"
              />
            </div>
            <div v-if="!isNew" class="timestamps">
              <div>Updated: {{ formatDate(parseDateString(component.modifiedAt)) }} UTC</div>
              <div>Created: {{ formatDate(parseDateString(component.createdAt)) }} UTC</div>
            </div>
          </div>
        </div>
      </div>
      <div class="row buttons-row">
        <div class="column">
          <button @click="submit">{{ isNew ? 'Create' : 'Save' }}</button>
        </div>
        <div v-if="!isNew" class="column is-narrow">
          <button @click="deleteLayout" class="is-dark is-delete">Delete</button>
        </div>
      </div>
      <transition name="fade">
        <div v-if="loading" class="loader-overlay">
          <cwa-loader />
        </div>
      </transition>
    </section>
  </cwa-modal>
</template>

<script lang="ts">
import CommonMixin from '../common-mixin'
import CwaModal from '../../../components/cwa-modal'
import CwaAdminText from '../../../components/admin/input/cwa-admin-text'
import StatusIcon from '../../../components/admin/status-icon'
import ErrorNotifications from '../../../components/admin/error-notifications'
import CwaAdminSelect from '../../../components/admin/input/cwa-admin-select'
import ApiDateParserMixin from '../../../../mixins/ApiDateParserMixin'
import CwaLoader from '../../../components/cwa-loader'
import {
  NotificationEvents,
  Notification,
  NotificationLevels,
  RemoveNotificationEvent
} from '../../../components/cwa-api-notifications/types'
import {Violation} from "../../../../../utils/AxiosErrorParser"
import ApiRequestError from "../../../../../inc/api-error"

export default {
  components: {CwaLoader, CwaAdminSelect, ErrorNotifications, StatusIcon, CwaAdminText, CwaModal},
  mixins: [CommonMixin, ApiDateParserMixin],
  data() {
    return {
      iri: decodeURIComponent(this.$route.params.iri),
      component: {
        reference: this.$route.query.reference || null
      },
      loading: true,
      savedComponent: {},
      unsavedCategory: 'layouts',
      violationsCategory: 'layouts.violations',
      notifications: {}
    } as {
      notifications: {[key: string]: Notification[]}
    }
  },
  async mounted() {
    if (this.isNew) {
      this.loading = false
      return
    }
    this.component = await this.$axios.$get(this.iri)
    this.component?.uiClassNames = this.component?.uiClassNames?.join(', ')
    this.loading = false
    this.savedComponent = Object.assign({}, this.component)
  },
  watch: {
    saved(isSaved) {
      if (!isSaved) {
        const notification: Notification = {
          code: 'unsaved',
          title: 'Layout not saved',
          message: 'Your changes are not saved',
          level: NotificationLevels.WARNING,
          category: this.unsavedCategory
        }
        this.$cwa.$eventBus.$emit(NotificationEvents.add, notification)
        return
      }
      const event: RemoveNotificationEvent = {
        code: 'unsaved',
        category: this.unsavedCategory
      }
      this.$cwa.$eventBus.$emit(NotificationEvents.remove, event)
    }
  },
  computed: {
    isNew() {
      return this.$route.params.iri === 'add'
    },
    saved() {
      return JSON.stringify(this.component) ===  JSON.stringify(this.savedComponent)
    },
    inputProps() {
      return key => ({
        id: `layout-${key}`,
        required: true,
        notifications: this.notifications[key]
      })
    }
  },
  methods: {
    async submit() {
      this.loading = true
      this.notifications = {}
      const uiClassNames = this.component?.uiClassNames?.split(',').map(item => (item.trim()))
      const data = {
        reference: this.component.reference,
        uiComponent: this.component.uiComponent,
        uiClassNames
      }
      try {
        if (this.isNew) {
          await this.$cwa.createResource('/_/layouts', data)
        } else {
          await this.$cwa.updateResource(this.iri, data)
        }
        this.$emit('change')
      } catch (error) {
        if (!(error instanceof ApiRequestError)) {
          throw error
        }
        error.violations.forEach((violation: Violation) => {
          const notification: Notification = {
            code: violation.propertyPath,
            title: violation.propertyPath,
            message: violation.message,
            level: NotificationLevels.ERROR,
            category: this.violationsCategory
          }
          const fieldNotifications = this.notifications[violation.propertyPath] || []
          fieldNotifications.push(notification)
          this.notifications[violation.propertyPath] = fieldNotifications
        })
      }

      this.loading = false
    },
    async deleteLayout() {
      this.loading = true
      await this.$cwa.deleteResource(this.iri)
      this.$emit('change')
      this.loading = false
    }
  }
}
</script>

<style lang="sass">
.layout-details-page
  .status-bar
    position: absolute
    top: 2rem
    left: 2rem
    display: flex
  .fields-container
    .right-column-aligner
      display: flex
      flex-direction: column
      height: 100%
      justify-content: space-between
    .timestamps
      margin-top: 1rem
      text-align: right
      color: $cwa-color-text-light
      font-size: 1.3rem
      justify-self: end
  .buttons-row
    margin-top: 2.5rem
    button.is-delete
      &:hover,
      &:focus
        border-color: $cwa-danger
        background: $cwa-danger
        color: $white
  .details-section
    position: relative
  .loader-overlay
    position: absolute
    top: 0
    left: 0
    width: 100%
    height: 100%
    background: rgba($cwa-navbar-background, .9)
</style>
