<template>
  <div :class="classes" v-if="resource">
    <component-position v-for="iri in sortedComponentPositions" :iri="iri" :key="iri" />
  </div>
  <component-load-error :class="classes" v-else :message="errorMessage">
    <template v-if="$cwa.isAdmin">
      <button @click="addComponentCollection">+ Add</button>
      <div v-if="addError" class="notice is-danger">{{ addError }}</div>
    </template>
  </component-load-error>
</template>

<script>
import ComponentLoadError from "@cwa/nuxt-modulecore/templates/component-load-error.vue"
import ApiError from "@cwa/nuxt-moduleinc/api-error"
import ComponentPosition from '@cwa/nuxt-module/core/templates/component-position.vue'

export default {
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
  data() {
    return {
      addError: null
    }
  },
  computed: {
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
    }
  }
}
</script>
