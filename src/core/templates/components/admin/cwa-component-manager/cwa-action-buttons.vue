<template>
  <div v-if="state && buttonOptions">
    <cm-button :alt-options="altOptions" @click="handleClick">
      {{ buttonOptions.default.label }}
    </cm-button>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import consola from 'consola'
import { EVENTS } from '../../../../mixins/ComponentManagerMixin'
import { ComponentCreatedEvent, NewComponentEvent } from '../../../../events'
import ApiError from '../../../../../inc/api-error'
import { RemoveNotificationEvent } from '../../cwa-api-notifications/types'
import ApiErrorNotificationsMixin from '../../../../mixins/ApiErrorNotificationsMixin'
import CloneComponentMixin from '../../../../mixins/CloneComponentMixin'
import CmButton, { altOption } from './input/cm-button.vue'
import UpdateResourceMixin from '@cwa/nuxt-module/core/mixins/UpdateResourceMixin'
import ApiDateParserMixin from '@cwa/nuxt-module/core/mixins/ApiDateParserMixin'

export default Vue.extend({
  components: { CmButton },
  mixins: [
    ApiErrorNotificationsMixin,
    CloneComponentMixin,
    UpdateResourceMixin,
    ApiDateParserMixin
  ],
  props: {
    selectedPosition: {
      type: String,
      required: false,
      default: null
    },
    selectedComponent: {
      type: Object,
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
            default: {
              label: 'Publish',
              fn: () => {
                this.publishNow(this.selectedComponent.iri)
              }
            },
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
      const resource = this.$cwa.getResource(this.selectedComponent.iri)
      return resource?._metadata?.published === false || false
    },
    refreshEndpoints() {
      const publishedResource = this.$cwa.getPublishedResource(
        this.$cwa.getResource(this.selectedComponent.iri)
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
    async handleClick(clickKey) {
      clickKey = clickKey || 'default'
      const fn: Function = this.buttonOptions[clickKey].fn
      await fn.apply(this, this.buttonOptions[clickKey].args || [])
    },
    selectCloneComponent() {
      this.cloneComponent = this.selectedComponent
      // this.cloneDestination = this.selectedPosition
    },
    newComponentListener(event: NewComponentEvent) {
      this.addingEvent = event
    },
    newComponentClearedListener() {
      this.addingEvent = null
    },
    async addComponent(publish: boolean) {
      if (!this.moment) {
        consola.error('Cannot add. Moment not loaded.')
        return
      }
      const notificationCategory = 'components-manager'
      const componentPosition: string = !this.addingEvent.dynamicPage
        ? this.addingEvent.position
        : null
      const componentGroup: string = this.addingEvent.collection
      const additionalData = { componentPositions: [] } as {
        componentPositions: Array<
          | string
          | {
              componentGroup: string
            }
        >
        publishedAt?: string
      }

      if (componentPosition) {
        additionalData.componentPositions.push(componentPosition)
      }
      if (componentGroup) {
        additionalData.componentPositions.push({
          componentGroup
        })
      }

      if (this.addingEvent?.isPublishable) {
        additionalData.publishedAt = publish
          ? this.moment.utc().toISOString()
          : null
      }
      const resourceObject = {
        ...this.$cwa.getResource(this.addingEvent.iri),
        ...additionalData
      }

      this.clearAllViolationNotifications()

      try {
        this.$cwa.$storage.increaseMercurePendingProcessCount()
        const refreshEndpoints = []
        if (this.addingEvent.position) {
          refreshEndpoints.push(this.addingEvent.position)
        }
        if (this.addingEvent.collection) {
          refreshEndpoints.push(this.addingEvent.collection)
        }
        const resource = await this.$cwa.createResource(
          this.addingEvent.endpoint,
          resourceObject,
          null,
          refreshEndpoints
        )
        this.$cwa.saveResource(resource)

        const refreshResources = []
        if (componentPosition) {
          refreshResources.push(componentPosition)
        }
        if (componentGroup) {
          refreshResources.push(...resource.componentPositions, componentGroup)
        }
        if (refreshResources.length) {
          await this.$cwa.refreshResources(refreshResources)
        }
        await this.$cwa.$storage.deleteResource(this.addingEvent.iri)

        const newIri = resource['@id']

        if (this.addingEvent.dynamicPage) {
          await this.$cwa.updateResource(
            this.addingEvent.dynamicPage.dynamicPage,
            {
              [this.addingEvent.dynamicPage.property]: newIri
            },
            null,
            [this.addingEvent.position]
          )
        }

        this.$cwa.$eventBus.$emit(EVENTS.selectComponent, newIri)
        this.$cwa.$eventBus.$emit(EVENTS.componentCreated, {
          tempIri: this.addingEvent.iri,
          newIri
        } as ComponentCreatedEvent)

        this.$cwa.$storage.decreaseMercurePendingProcessCount()
        this.addingEvent = null
        this.$cwa.$eventBus.$emit(EVENTS.newComponentCleared)
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
