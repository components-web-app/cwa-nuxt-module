import Vue from 'vue'
import consola from 'consola'
import { NewComponentEvent, NewComponentEventDynamicPage } from '../events'
import FetchComponentsMixin from './FetchComponentsMixin'
// @ts-ignore
import components from '~/.nuxt/cwa/components'

export default Vue.extend({
  mixins: [FetchComponentsMixin],
  data() {
    return {
      availableComponents: {}
    }
  },
  async mounted() {
    await this.loadAvailableComponents()
  },
  methods: {
    async loadAvailableComponents() {
      this.availableComponents = await this.fetchComponents()
    },
    async createNewComponentEvent(
      newComponent: string,
      collection: string = null,
      position: string = null,
      dynamicPage: NewComponentEventDynamicPage = null
    ): Promise<NewComponentEvent> {
      if (!this.availableComponents) {
        consola.warn('availableComponents not loaded')
      }
      // get the component for the dialog from the ui component
      const component = await components[`CwaComponents${newComponent}`]
      const {
        endpoint,
        resourceName: name,
        isPublishable
      } = this.availableComponents[newComponent]
      return {
        collection,
        position,
        component,
        endpoint,
        iri: `${endpoint}/new`,
        name,
        isPublishable,
        dynamicPage
      } as NewComponentEvent
    }
  }
})
