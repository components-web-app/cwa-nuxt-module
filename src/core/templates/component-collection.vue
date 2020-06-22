<template>
  <div :class="classes" v-if="resource">
    <error-component v-if="!sortedComponentPositions.length" message="No components exist in this collection" />
    <component-position v-for="iri in sortedComponentPositions" :iri="iri" :key="iri" />
    <div v-if="requestError" class="notice is-danger">{{ requestError }}</div>
  </div>
  <component-load-error :class="classes" v-else :message="errorMessage">
    <!-- v-if causes ssr mis-matched render -->
    <template v-show="$cwa.isAdmin">
      <button @click="addComponentCollection">+ Add</button>
      <div v-if="requestError" class="notice is-danger">{{ requestError }}</div>
    </template>
  </component-load-error>
</template>

<script>
import ComponentLoadError from "@cwa/nuxt-module/core/templates/component-load-error.vue"
import ComponentPosition from '@cwa/nuxt-module/core/templates/component-position.vue'
import ContextMenuMixin from "@cwa/nuxt-module/core/mixins/ContextMenuMixin"
import ApiRequestMixin from "@cwa/nuxt-module/core/mixins/ApiRequestMixin"

export default {
  mixins: [ContextMenuMixin, ApiRequestMixin],
  components: {
    ComponentLoadError,
    ComponentPosition,
    ErrorComponent: () => import('./component-load-error')
  },
  props: {
    location: {
      type: String,
      required: true
    },
    pageId: {
      type: String,
      required: true
    },
    pageReference: {
      type: String,
      required: true
    }
  },
  computed: {
    contextMenuCategory() {
      return `Component Collection (${this.resource ? this.resource.reference : this.location})`
    },
    resource() {
      return this.getCollectionResourceByLocation(this.location, this.pageId)
    },
    errorMessage() {
      return `The ComponentCollection resource with location <b>${this.location}</b> was not returned by the API`
    },
    classes() {
      return [
        'component-collection',
        this.resource ? [this.resource.location, this.resource.reference] : 'not-found',
        { 'is-deleting': this.apiBusy }
      ]
    },
    sortedComponentPositions() {
      const positions = []
      for (const iri of this.resource.componentPositions) {
        const postObj = this.$cwa.resources.ComponentPosition.byId[iri]
        postObj && positions.push(postObj)
      }
      return positions.sort((a, b) => (a.sortValue > b.sortValue) ? 1 : -1).map(({ '@id': id }) => id)
    },
    defaultContextMenuData() {
      if (!this.resource) {
        return {
          'Create component collection': {
            callback: this.addComponentCollection
          }
        }
      }
      return {
        'Add component': {
          callback: this.addComponent
        },
        'Delete component collection': {
          callback: this.deleteSelf
        }
      }
    }
  },
  methods: {
    getCollectionResourceByLocation(location, pageId) {
      const ComponentCollection = this.$cwa.resources.ComponentCollection
      for (const id in ComponentCollection.byId) {
        const resource = ComponentCollection.byId[id]
        if (resource && resource.location === location && resource.pages.indexOf(pageId) !== -1) {
          return resource
        }
      }
      return null
    },
    async addComponentCollection() {
      this.startApiRequest()
      try {
        await this.$cwa.createResource('/_/component_collections', {
          reference: `${this.pageReference}_${this.location}`,
          location: this.location,
          pages: [this.pageId]
        })
      } catch (err) {
        this.handleApiError(err)
      }
      this.completeApiRequest()
    },
    async deleteSelf() {
      this.startApiRequest()
      try {
        await this.$cwa.deleteResource(this.resource['@id'], this.resource['@type'])
      } catch (err) {
        this.handleApiError(err)
      }
      this.completeApiRequest()
    },
    addComponent() {
      alert('this will add a component to collection ' + this.resource['@id'])
    }
  }
}
</script>

<style lang="sass" scoped>
.component-collection
  &.is-deleting
    opacity: .5
</style>
