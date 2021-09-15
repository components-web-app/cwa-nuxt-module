<template>
  <div>
    <cm-button
      v-if="selectedPosition"
      :alt-options="deleteOptions"
      @click="deleteComponent"
      >Delete Component
    </cm-button>
    <cm-button
      v-if="addingEvent"
      :alt-options="addNewOptions"
      @click="addComponent"
      >{{ addNewButtonLabel }}
    </cm-button>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import moment from 'moment'
import { EVENTS } from '../../../../mixins/ComponentManagerMixin'
import {
  CONFIRM_DIALOG_EVENTS,
  ConfirmDialogEvent,
  NewComponentEvent
} from '../../../../events'
import ApiError from '../../../../../inc/api-error'
import { RemoveNotificationEvent } from '../../cwa-api-notifications/types'
import ApiErrorNotificationsMixin from '../../../../mixins/ApiErrorNotificationsMixin'
import CmButton, { altOption } from './input/cm-button.vue'

export default Vue.extend({
  components: { CmButton },
  mixins: [ApiErrorNotificationsMixin],
  props: {
    selectedPosition: {
      type: String,
      required: false,
      default: null
    },
    selectedComponent: {
      type: String,
      required: false,
      default: null
    }
  },
  data() {
    return {
      addingEvent: null,
      removeErrorEvents: []
    } as {
      addingEvent: NewComponentEvent
      removeErrorEvents: RemoveNotificationEvent[]
    }
  },
  computed: {
    addNewOptions(): altOption[] {
      return this.addingEvent?.isPublishable
        ? [
            { label: 'Add as published', key: 'published' },
            { label: 'Add as draft', key: 'draft' }
          ]
        : null
    },
    deleteOptions(): altOption[] {
      return [
        { label: 'Delete here', key: 'here' },
        { label: 'Delete everywhere', key: 'everywhere' }
      ]
    },
    addNewButtonLabel() {
      return this.addingEvent?.isPublishable ? 'Add Draft' : 'Add New'
    }
  },
  beforeMount() {
    this.$cwa.$eventBus.$on(EVENTS.newComponent, this.newComponentListener)
    this.$cwa.$eventBus.$on(
      EVENTS.newComponentCleared,
      this.newComponentClearedListener
    )
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off(EVENTS.newComponent, this.newComponentListener)
    this.$cwa.$eventBus.$off(
      EVENTS.newComponentCleared,
      this.newComponentClearedListener
    )
  },
  methods: {
    newComponentListener(event: NewComponentEvent) {
      this.addingEvent = event
    },
    newComponentClearedListener() {
      this.addingEvent = null
    },
    async addComponent(key: string) {
      const notificationCategory = 'components-manager'
      const componentCollection: string = this.addingEvent.collection
      const additionalData = {
        componentPositions: [
          {
            componentCollection
          }
        ]
      } as {
        componentPositions: {
          componentCollection: string
        }[]
        publishedAt?: string
      }
      if (key) {
        additionalData.publishedAt =
          key === 'published' ? moment.utc().toISOString() : null
      }
      const resourceObject = Object.assign(
        {},
        this.$cwa.getResource(this.addingEvent.iri),
        additionalData
      )

      this.clearAllViolationNotifications()

      try {
        this.$cwa.$storage.increaseMercurePendingProcessCount()
        const resource = await this.$cwa.createResource(
          this.addingEvent.endpoint,
          resourceObject,
          null,
          [this.addingEvent.collection]
        )
        this.$cwa.saveResource(resource)
        await this.$cwa.refreshResources([
          ...resource.componentPositions,
          componentCollection
        ])
        await this.$cwa.$storage.deleteResource(this.addingEvent.iri)
        this.$cwa.$eventBus.$emit(EVENTS.selectComponent, resource['@id'])
        this.addingEvent = null
        this.$cwa.$storage.decreaseMercurePendingProcessCount()
      } catch (message) {
        if (!(message instanceof ApiError)) {
          throw message
        }
        if (message.isCancel) {
          return
        }
        this.handleApiViolations(
          message.violations,
          this.addingEvent.iri,
          notificationCategory
        )
      }
    },
    deleteComponent(key) {
      const message =
        key === 'here'
          ? '<p>Are you sure you want to delete this component from this location?</p><p>If it does not exist anywhere else it will be permanently deleted.</p>'
          : '<p>Are you sure you want to delete every instance of this component from your entire website?</p>'
      const event: ConfirmDialogEvent = {
        id: 'confirm-delete-component',
        title: 'Confirm Delete',
        html: `${message}<p class="warning"><span class="cwa-icon"><span class="cwa-warning-triangle"></span></span><span>This action cannot be reversed!</span></p>`,
        onSuccess: async () => {
          const deleteResource =
            key === 'here' ? this.selectedPosition : this.selectedComponent
          await this.$cwa.deleteResource(deleteResource)
          this.$emit('close')
        },
        confirmButtonText: key === 'here' ? 'Delete Here' : 'Delete Everywhere'
      }
      this.$cwa.$eventBus.$emit(CONFIRM_DIALOG_EVENTS.confirm, event)
    }
  }
})
</script>
