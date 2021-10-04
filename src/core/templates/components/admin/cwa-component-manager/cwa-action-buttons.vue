<template>
  <div>
    <cm-button
      v-if="selectedComponent && !reuseComponent"
      @click="selectReuseComponent"
    >
      Reuse
    </cm-button>
    <cm-button
      v-if="selectedComponent && reuseDestination"
      @click="reuseComponent"
    >
      Reuse here
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
import { NewComponentEvent } from '../../../../events'
import ApiError from '../../../../../inc/api-error'
import { RemoveNotificationEvent } from '../../cwa-api-notifications/types'
import ApiErrorNotificationsMixin from '../../../../mixins/ApiErrorNotificationsMixin'
import ReuseComponentMixin from '../../../../mixins/ReuseComponentMixin'
import CmButton, { altOption } from './input/cm-button.vue'

export default Vue.extend({
  components: { CmButton },
  mixins: [ApiErrorNotificationsMixin, ReuseComponentMixin],
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
    selectReuseComponent() {
      this.reuseComponent = this.selectedComponent
    },
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
      const resourceObject = {
        ...this.$cwa.getResource(this.addingEvent.iri),
        ...additionalData
      }

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
    }
  }
})
</script>
