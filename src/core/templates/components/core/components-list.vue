<template>
  <div class="available-components-list">
    <button class="button button-clear" @click="$emit('close')">X</button>
    <div v-if="loadingComponents">Loading components</div>
    <div v-else-if="addingComponent">Adding component</div>
    <div v-else-if="!availableComponents.length">No components available</div>
    <ul v-else>
      <li
        v-for="availableComponent in availableComponents"
        :key="availableComponent.endpoint"
      >
        <button
          class="button-outline"
          @click="addComponent(availableComponent.endpoint)"
        >
          + {{ availableComponent.resource }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { StoreCategories } from '../../../storage'
import ApiError from '../../../../inc/api-error'
import { NOTIFICATION_EVENTS } from '../../../events'
import {
  NotificationEvent,
  NotificationLevels
} from '@cwa/nuxt-module/core/templates/components/cwa-api-notifications/types'

export default Vue.extend({
  props: {
    addData: {
      type: Object,
      required: false,
      default() {
        return {}
      }
    }
  },
  data() {
    return {
      loadingComponents: false,
      addingComponent: false,
      availableComponents: []
    }
  },
  async mounted() {
    this.availableComponents = await this.fetchComponents()
  },
  methods: {
    async fetchComponents() {
      const components = []
      this.loadingComponents = true
      const data = await this.$cwa.getApiDocumentation()
      for (const [key, endpoint] of Object.entries(
        data.entrypoint
      ) as string[][]) {
        if (endpoint.startsWith('/component/')) {
          components.push({
            resource: key[0].toUpperCase() + key.slice(1),
            endpoint
          })
        }
      }
      this.loadingComponents = false
      return components
    },
    async addComponent(component) {
      this.addingComponent = true
      try {
        await this.$cwa.createResource(
          component,
          this.addData,
          StoreCategories.Component
        )
      } catch (error) {
        if (!(error instanceof ApiError)) {
          throw error
        }
        const notification: NotificationEvent = {
          code: 'components-list',
          title: 'An error occurred',
          message: error.message,
          level: NotificationLevels.ERROR
        }
        this.$cwa.$eventBus.$emit(NOTIFICATION_EVENTS.add, notification)
      }
      this.addingComponent = false
      this.$emit('added')
    }
  }
})
</script>

<style lang="sass" scoped>
.available-components-list
  padding: 1rem
  border: 1px solid $cwa-color-primary
</style>
