<template>
  <resource-component-loader
    v-if="!!component"
    :component="`CwaComponents${component.uiComponent || component['@type']}`"
    :iri="componentIri"
    :sort-value="resource.sortValue"
    :show-sort="showSort"
    @deleted="$emit('deleted')"
  />
  <div v-else-if="resource.pageDataProperty">
    The property [{{ resource.pageDataProperty }}] will be added here from page
    data
  </div>
</template>

<script>
import ComponentManagerMixin, {
  EVENTS
} from '@cwa/nuxt-module/core/mixins/ComponentManagerMixin'
import consola from 'consola'
import { API_EVENTS } from '@cwa/nuxt-module/core/events'
import ResourceComponentLoader from '../../resource-component-loader'
import components from '~/.nuxt/cwa/components'

export default {
  components: {
    ResourceComponentLoader,
    ...components
  },
  mixins: [ComponentManagerMixin],
  props: {
    iri: {
      type: String,
      required: true
    },
    showSort: {
      type: Boolean,
      default: false,
      required: false
    }
  },
  data() {
    return {
      componentLoadFailed: false
    }
  },
  computed: {
    resource() {
      return this.$cwa.getResource(this.iri)
    },
    componentIri() {
      return this.$cwa.getPublishableIri(this.resource.component)
    },
    component() {
      if (!this.resource) {
        return null
      }
      return this.$cwa.getResource(this.componentIri)
    }
  },
  async mounted() {
    // load the component if not loaded
    if (!this.component) {
      // check if no published version, only a draft (i.e. only an authorized viewer can see it)
      if (this.$cwa.user && this.resource.component) {
        await this.$cwa.fetcher.fetchComponent(this.resource.component)
      }
      if (!this.component) {
        if (!this.resource.pageDataProperty && this.$cwa.isAdmin) {
          await this.$cwa.fetcher.fetchComponent(this.resource['@id'])
        }
        this.componentLoadFailed = true
      }
    }
    this.$cwa.$eventBus.$on(API_EVENTS.newDraft, this.newDraftListener)
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off(API_EVENTS.newDraft, this.newDraftListener)
  },
  methods: {
    componentManagerShowListener() {
      if (!this.resource) {
        consola.error(
          'Could not add component to component manager. No resource is defined',
          this
        )
        return
      }
      this.$cwa.$eventBus.$emit(EVENTS.selectPosition, this.iri)
    },
    newDraftListener({ publishedIri, draftIri }) {
      if (this.resource.component === publishedIri && draftIri) {
        const resource = Object.assign({}, this.resource, {
          component: draftIri
        })
        this.$cwa.$storage.setResource({
          resource,
          isNew: false
        })
      }
    }
  }
}
</script>
