<template>
  <div>
    <cwa-admin-select
      id="component"
      v-model="selectedComponent"
      label="Add"
      :options="componentOptions"
      :wrapper="wrapperComponent"
    />
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import CreateNewComponentEventMixin from '../../../../../../mixins/CreateNewComponentEventMixin'
import { COMPONENT_MANAGER_EVENTS } from '../../../../../../events'
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import CwaAdminSelect from '../../../input/cwa-admin-select.vue'
import FetchComponentsMixin from '../../../../../../mixins/FetchComponentsMixin'

export default Vue.extend({
  components: { CwaAdminSelect },
  mixins: [
    ComponentManagerTabMixin,
    FetchComponentsMixin,
    CreateNewComponentEventMixin
  ],
  data() {
    return {
      selectedComponent: null,
      wrapperComponent: async () => await import('../../input/wrapper.vue')
    }
  },
  computed: {
    componentOptions() {
      if (!this.availableComponents) {
        return []
      }
      const objKeys = Object.keys(this.availableComponents)
      if (!this.resource.allowedComponents) {
        return objKeys
      }

      return objKeys.filter((key) => {
        return this.resource.allowedComponents.includes(
          this.availableComponents[key].endpoint
        )
      })
    }
  },
  watch: {
    async selectedComponent(newComponent: string) {
      if (!newComponent) {
        return
      }
      const event = await this.createNewComponentEvent(
        newComponent,
        this.resource['@id']
      )
      this.$cwa.$eventBus.$emit(COMPONENT_MANAGER_EVENTS.newComponent, event)
      this.selectedComponent = null
    }
  }
})
</script>
