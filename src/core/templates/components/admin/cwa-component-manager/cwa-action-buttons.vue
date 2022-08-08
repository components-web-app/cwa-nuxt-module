<template>
  <div v-if="state && buttonOptions">
    <cm-button :alt-options="altOptions" @click="handleClick">
      {{ buttonOptions.default.label }}
    </cm-button>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import moment from 'moment'
import consola from 'consola'
import { EVENTS } from '../../../../mixins/ComponentManagerMixin'
import { ComponentCreatedEvent, NewComponentEvent } from '../../../../events'
import ApiError from '../../../../../inc/api-error'
import { RemoveNotificationEvent } from '../../cwa-api-notifications/types'
import ApiErrorNotificationsMixin from '../../../../mixins/ApiErrorNotificationsMixin'
import CloneComponentMixin from '../../../../mixins/CloneComponentMixin'
import CmButton, { altOption } from './input/cm-button.vue'
import UpdateResourceError from '@cwa/nuxt-module/inc/update-resource-error'
import UpdateResourceMixin from '@cwa/nuxt-module/core/mixins/UpdateResourceMixin'

export default Vue.extend({
  components: { CmButton },
  mixins: [
    ApiErrorNotificationsMixin,
    CloneComponentMixin,
    UpdateResourceMixin
  ],
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
    state() {
      if (this.addingEvent) {
        return 1
      }
      if (this.selectedComponent && !this.cloneComponent) {
        return 2
      }
      if (this.selectedComponent && this.cloneDestination) {
        return 3
      }
      return null
    },
    buttonOptions() {
      if (this.state === 1) {
        if (!this.addingEvent?.isPublishable) {
          return {
            default: { label: 'Add New', fn: this.addComponent }
          }
        }
        return {
          default: { label: 'Add Draft', fn: this.addComponent, args: [false] },
          addNew: {
            label: 'Add & Publish',
            fn: this.addComponent,
            args: [true]
          }
        }
      }
      if (this.state === 2) {
        if (this.isDraft) {
          return {
            default: { label: 'Publish', fn: this.publishNow },
            clone: { label: 'Clone', fn: this.selectCloneComponent }
          }
        }
        return {
          default: { label: 'Clone', fn: this.selectCloneComponent }
        }
      }
      return null
    },
    altOptions(): altOption[] {
      return Object.keys(this.buttonOptions)
        .filter((key) => key !== 'default')
        .map((key) => ({ key, label: this.buttonOptions[key].label }))
    },
    isDraft() {
      const resource = this.$cwa.getResource(this.selectedComponent)
      return resource?._metadata?.published === false || false
    },
    refreshEndpoints() {
      const publishedResource = this.$cwa.getPublishedResource(
        this.$cwa.getResource(this.selectedComponent)
      )
      return publishedResource?.componentPositions || null
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
    handleClick(clickKey) {
      clickKey = clickKey || 'default'
      this.buttonOptions[clickKey].fn.apply(
        this,
        this.buttonOptions[clickKey].args || []
      )
    },
    async publishNow() {
      try {
        await this.updateResource(
          this.selectedComponent,
          'publishedAt',
          moment.utc().toISOString(),
          this.$cwa.$storage.getCategoryFromIri(this.selectedComponent),
          this.refreshEndpoints,
          'components-manager'
        )
        this.$emit('close')
      } catch (error) {
        if (!(error instanceof UpdateResourceError)) {
          throw error
        }
        consola.error(error)
      }
    },
    selectCloneComponent() {
      this.cloneComponent = this.selectedComponent
      this.cloneDestination = this.selectedPosition
    },
    newComponentListener(event: NewComponentEvent) {
      this.addingEvent = event
    },
    newComponentClearedListener() {
      this.addingEvent = null
    },
    async addComponent(publish: boolean) {
      const notificationCategory = 'components-manager'
      const componentPosition: string = this.addingEvent.position
      const componentCollection: string = this.addingEvent.collection
      const additionalData = { componentPositions: [] } as {
        componentPositions: Array<
          | string
          | {
              componentCollection: string
            }
        >
        publishedAt?: string
      }

      if (componentPosition) {
        additionalData.componentPositions.push(componentPosition)
      }
      if (componentCollection) {
        additionalData.componentPositions.push({
          componentCollection
        })
      }

      if (this.addingEvent?.isPublishable) {
        additionalData.publishedAt = publish ? moment.utc().toISOString() : null
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
          this.addingEvent.collection ? [this.addingEvent.collection] : null
        )
        this.$cwa.saveResource(resource)

        const refreshResources = []
        if (componentPosition) {
          refreshResources.push(componentPosition)
        }
        if (componentCollection) {
          refreshResources.push(
            ...resource.componentPositions,
            componentCollection
          )
        }
        if (refreshResources.length) {
          await this.$cwa.refreshResources(refreshResources)
        }
        await this.$cwa.$storage.deleteResource(this.addingEvent.iri)
        this.$cwa.$eventBus.$emit(EVENTS.selectComponent, resource['@id'])
        this.$cwa.$eventBus.$emit(EVENTS.componentCreated, {
          tempIri: this.addingEvent.iri,
          newIri: resource['@id']
        } as ComponentCreatedEvent)
        this.addingEvent = null
        this.$cwa.$storage.decreaseMercurePendingProcessCount()
      } catch (message) {
        if (!(message instanceof ApiError)) {
          throw message
        }
        if (message.isCancel) {
          return
        }
        if (!message.violations) {
          consola.error(message.message)
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
