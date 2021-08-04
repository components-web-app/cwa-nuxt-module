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
import {
  COMPONENT_MANAGER_EVENTS,
  NewComponentEvent
} from '../../../../../../events'
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import CwaAdminSelect from '../../../input/cwa-admin-select.vue'
import FetchComponentsMixin from '../../../../../../mixins/FetchComponentsMixin'
import components from '~/.nuxt/cwa/components'

export default Vue.extend({
  components: { CwaAdminSelect },
  mixins: [ComponentManagerTabMixin, FetchComponentsMixin],
  data() {
    return {
      availableComponents: [],
      selectedComponent: null,
      wrapperComponent: async () => await import('../../input/wrapper.vue')
    }
  },
  computed: {
    componentOptions() {
      return Object.keys(this.availableComponents)
    }
  },
  watch: {
    async selectedComponent(newComponent: string) {
      // get the component for the dialog from the ui component
      const component = await components[`CwaComponents${newComponent}`]
      const {
        endpoint,
        resourceName: name,
        isPublishable
      } = this.availableComponents[newComponent]
      const event: NewComponentEvent = {
        collection: this.resource['@id'],
        component,
        endpoint,
        iri: `${endpoint}/new`,
        name,
        isPublishable
      }
      this.$cwa.$eventBus.$emit(COMPONENT_MANAGER_EVENTS.newComponent, event)
    }
  },
  async mounted() {
    this.availableComponents = await this.fetchComponents()
  }
})
</script>
