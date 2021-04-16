<template>
  <div>
    <resource-component-loader
      v-if="component"
      :component="`CwaComponents${component.uiComponent || component['@type']}`"
      :iri="resource.component"
      :sort-value="resource.sortValue"
      :show-sort="showSort"
      @deleted="$emit('deleted')"
    />
    <div v-else-if="resource.pageDataProperty">
      The property [{{ resource.pageDataProperty }}] will be added here from
      page data
    </div>
  </div>
</template>

<script>
import { StoreCategories } from '@cwa/nuxt-module/core/storage'
import ComponentManagerMixin, {
  EVENTS
} from '@cwa/nuxt-module/core/mixins/ComponentManagerMixin'
import consola from 'consola'
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
      return this.$cwa.resources.ComponentPosition.byId[this.iri]
    },
    component() {
      if (!this.resource) {
        return null
      }
      return this.$cwa.getResource(this.resource.component)
    }
  },
  async mounted() {
    if (!this.component) {
      // check if no published version, only a draft
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
      this.$cwa.$eventBus.$emit(EVENTS.selectPosition, this.resource['@id'])
    }
  }
}
</script>
