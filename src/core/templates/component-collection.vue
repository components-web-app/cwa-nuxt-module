<template>
  <div :class="classes" v-if="resource">
    <component-position v-for="iri in sortedComponentPositions" :iri="iri" :key="iri" />
  </div>
  <component-load-error :class="classes" v-else :message="errorMessage">
    <!-- v-if causes ssr mis-matched render -->
    <template v-show="$cwa.isAdmin">
      <button @click="addComponentCollection">+ Add</button>
      <div v-if="addError" class="notice is-danger">{{ addError }}</div>
    </template>
  </component-load-error>
</template>

<script>
import ComponentLoadError from "@cwa/nuxt-modulecore/templates/component-load-error.vue"
import ApiError from "@cwa/nuxt-moduleinc/api-error"
import ComponentPosition from '@cwa/nuxt-module/core/templates/component-position.vue'
import ContextMenuMixin from "@cwa/nuxt-module/core/mixins/ContextMenuMixin";

export default {
  mixins: [ContextMenuMixin],
  data() {
    return {
      addError: null
    }
  },
  components: {
    ComponentLoadError,
    ComponentPosition
  },
  props: {
    location: {
      type: String,
      required: true
    },
    pageId: {
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
        this.resource ? [this.resource.location, this.resource.reference] : 'not-found'
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
    getCollectionResourceByLocation(location, page) {
      const ComponentCollection = this.$cwa.resources.ComponentCollection
      for (const id in ComponentCollection.byId) {
        const resource = ComponentCollection.byId[id]
        if (resource && resource.location === location && resource.pages.indexOf(page) !== -1) {
          return resource
        }
      }
      return null
    },
    async addComponentCollection() {
      this.error = null
      try {
        await this.$cwa.addResource('/_/component_positions', {

        })
      } catch (err) {
        if (err instanceof ApiError) {
          this.addError = err.message
          return
        }
        throw err
      }
    },
    addComponent() {
      alert('this will add a component to collection ' + this.resource['@id'])
    },
    async deleteSelf() {
      await this.$cwa.deleteResource(this.resource['@id'])
    }
  }
}
</script>
