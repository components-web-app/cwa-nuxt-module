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
import { NewComponentEvent } from '../../../../events'
import CmButton, { altOption } from './input/cm-button.vue'

export default Vue.extend({
  components: { CmButton },
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
      addingEvent: null
    } as {
      addingEvent: NewComponentEvent
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
    },
    async deleteComponent(key) {
      if (!window.confirm('Are you sure?')) {
        return
      }
      const deleteResource =
        key === 'here' ? this.selectedPosition : this.selectedComponent
      await this.$cwa.deleteResource(deleteResource)
      this.$emit('close')
    }
  }
})
</script>
