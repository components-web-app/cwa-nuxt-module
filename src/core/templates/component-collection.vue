<template>
  <!-- if the collection exists -->
  <div :class="[{'is-admin': $cwa.isAdmin, 'is-empty': !sortedComponentPositions.length}, ...classes]" v-if="resource">
    <!-- if there are no components -->
    <client-only v-if="$cwa.isEditMode()">
      <component-load-error v-if="!sortedComponentPositions.length">
        <div class="add-button-holder" @click="displayComponents">
          <cwa-add-button :highlight="true"></cwa-add-button>
        </div>
      </component-load-error>
    </client-only>
    <!-- else we loop through components -->
    <component
      :is="$cwa.isEditMode() ? 'draggable' : 'div'"
      :group="`collection-${resource['@id']}`"
      v-model="sortedComponentPositions"
      @change="draggableChanged"
    >
      <component-position v-for="iri in sortedComponentPositions" :iri="iri" :key="iri" />
    </component>
  </div>
</template>

<script lang="ts">
import slugify from 'slugify'
import ComponentPosition from '@cwa/nuxt-module/core/templates/component-position.vue'
import AdminDialogMixin from "@cwa/nuxt-module/core/mixins/AdminDialogMixin"
import ApiRequestMixin from "@cwa/nuxt-module/core/mixins/ApiRequestMixin"
import CwaAddButton from './components/cwa-add-button.vue'

export default {
  mixins: [AdminDialogMixin, ApiRequestMixin],
  components: {
    CwaAddButton,
    ComponentPosition,
    ComponentLoadError: () => import('./component-load-error.vue'),
    Draggable: () => import('vuedraggable'),
  },
  props: {
    location: {
      type: String,
      required: true
    },
    locationResourceId: {
      type: String,
      required: true
    },
    locationResourceReference: {
      type: String,
      required: true
    },
    isPage: {
      type: Boolean,
      required: true
    }
  },
  async mounted() {
    if (!this.resource && this.$cwa.isAdmin) {
      await this.addComponentCollection()
    }
  },
  data() {
    return {
      apiRequestCategory: {
        collection: 'collection'
      },
      showComponentsList: false,
      reloading: false,
      previousSortedComponentPositions: null
    }
  },
  computed: {
    resourceTypeKey() {
      return this.isPage ? 'pages' : 'layouts'
    },
    componentPostData() {
      return {
        componentPositions: [
          {
            componentCollection: this.resource['@id']
          }
        ]
      }
    },
    contextMenuCategory() {
      return `Component Collection (${this.resource ? this.resource.reference : this.location})`
    },
    resource() {
      return this.getCollectionResourceByLocation(this.location, this.locationResourceId)
    },
    classes() {
      return [
        'component-collection',
        this.resource ? [this.resource.location, slugify(this.resource.reference, {
          lower: true
        })] : 'not-found',
        { 'is-deleting': this.apiBusy, 'is-reloading': this.reloading }
      ]
    },
    sortedComponentPositions: {
      get() {
        if (!this.$cwa.resources.ComponentPosition) {
          return []
        }
        const positions = []
        for (const iri of this.resource.componentPositions) {
          const position = this.$cwa.resources.ComponentPosition.byId[iri]
          position && positions.push(position)
        }
        return positions.sort((a, b) => (a.sortValue > b.sortValue) ? 1 : -1).map(({ '@id': id }) => id)
      },
      set: function (newIriArray) {
        this.previousSortedComponentPositions = []
        this.sortedComponentPositions.forEach(iri => {
          this.previousSortedComponentPositions.push({
            iri,
            sortValue: this.$cwa.resources.ComponentPosition.byId[iri].sortValue
          })
        })

        for (const [index, iri] of newIriArray.entries()) {
          const position = this.$cwa.resources.ComponentPosition.byId[iri]
          const newPosition = Object.assign({}, position, {sortValue: index})
          this.$cwa.saveResource(newPosition)
        }
      }
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
          callback: this.displayComponents
        },
        'Delete component collection': {
          callback: this.deleteSelf
        }
      }
    }
  },
  methods: {
    getCollectionResourceByLocation(location, locationResourceId) {
      const ComponentCollection = this.$cwa.resources?.ComponentCollection
      if (!ComponentCollection) {
        return
      }
      for (const id in ComponentCollection.byId) {
        const resource = ComponentCollection.byId[id]
        if (resource && resource.location === location && resource[this.resourceTypeKey].indexOf(locationResourceId) !== -1) {
          return resource
        }
      }
      return null
    },
    async addComponentCollection() {
      this.startApiRequest(this.apiRequestCategory.collection)
      try {
        await this.$cwa.createResource('/_/component_collections', {
          reference: `${this.locationResourceReference}_${this.location}`,
          location: this.location,
          [this.resourceTypeKey]: [this.locationResourceId]
        })
      } catch (err) {
        this.handleApiError(err, this.apiRequestCategory.collection)
      }
      this.completeApiRequest()
    },
    async deleteSelf() {
      this.startApiRequest()
      try {
        await this.$cwa.deleteResource(this.resource['@id'])
      } catch (err) {
        this.handleApiError(err)
      }
      this.completeApiRequest()
    },
    async displayComponents() {
      this.showComponentsList = true
    },
    componentAdded() {
      this.showComponentsList = false
      this.reloadCollection()
    },
    async reloadCollection() {
      this.reloading = true
      await this.$cwa.fetcher.fetchComponentCollection(this.resource['@id'])
      this.reloading = false
    },
    async draggableChanged({ moved }) {
      this.reloading = true
      const previousPosition = this.previousSortedComponentPositions[moved.newIndex]
      await this.$cwa.updateResource(moved.element, { sortValue: previousPosition.sortValue })
      this.previousSortedComponentPositions = null
      this.reloading = false
    }
  }
}
</script>

<style lang="sass" scoped>
@keyframes loading
  0%
    opacity: 1
  50%
    opacity: .5
  100%
    opacity: 1
.component-collection
  transition: opacity .3s
  opacity: 1
  &.is-deleting
    opacity: .5
  &.is-reloading
    animation: loading normal 1s infinite ease-in-out
  &.is-admin.is-empty
    border: 1px dashed $cwa-grid-item-border-color
  .add-button-holder
    display: flex
    justify-content: center
    padding: 2rem
</style>
