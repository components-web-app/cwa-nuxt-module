<template>
  <div :class="classes" v-if="resource">
    Component Collection {{ resource }}
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
import ApiError from "@cwa/nuxt-moduleinc/api-error";

export default {
  components: {ComponentLoadError},
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
      return this.getCollectionIriByLocation(this.location)
    },
    errorMessage() {
      return `The ComponentCollection resource with location <b>${this.location}</b> was not returned by the API`
    },
    classes() {
      return [
        'component-collection',
        this.resource ? [this.resource.location, this.resource.reference] : 'not-found'
      ]
    }
  },
  methods: {
    getCollectionIriByLocation(location) {
      const ComponentCollection = this.$cwa.resources.ComponentCollection
      for (const id in ComponentCollection.byId) {
        const resource = ComponentCollection.byId[id]
        if (resource.location === location) {
          return resource
        }
      }
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
