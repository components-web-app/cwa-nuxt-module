<template>
  <!-- if the collection exists -->
  <div :class="[{'is-editing': $cwa.isEditMode(), 'is-empty': !sortedComponentPositions.length}, ...classes]" v-if="resource">
    <!-- if there are no components -->
    <client-only v-if="$cwa.isEditMode()">
      <component-load-error v-if="!sortedComponentPositions.length">
        <div class="add-button-holder">
          <cwa-add-button :highlight="true" @click.native="addMenuItemShownListener"></cwa-add-button>
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
    //
    locationResourceType: {
      type: String,
      required: true,
      validate(value) {
        return ['pages', 'layouts', 'components'].indexOf(value) !== -1
      }
    }
  },
  data() {
    return {
      apiRequestCategory: {
        collection: 'collection'
      },
      reloading: false,
      previousSortedComponentPositions: null,
      lastClickEvent: null
    }
  },
  async mounted() {
    if (!this.resource && this.$cwa.isAdmin) {
      await this.addComponentCollection()
    }
  },
  computed: {
    adminDialogName() {
      return `Component Group`
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
    }
    // defaultContextMenuData() {
    //   if (!this.resource) {
    //     return {
    //       'Create component collection': {
    //         callback: this.addComponentCollection
    //       }
    //     }
    //   }
    //   return {
    //     'Add component': {
    //       callback: this.displayComponents
    //     },
    //     'Delete component collection': {
    //       callback: this.deleteSelf
    //     }
    //   }
    // }
  },
  methods: {
    addMenuItemShownListener(event) {
      this.lastClickEvent = event
      this.$cwa.$eventBus.$once('cwa:admin-dialog:shown-item', this.positionAdminDialog)
      setTimeout(() => {
        this.$cwa.$eventBus.$off('cwa:admin-dialog:shown-item', this.positionAdminDialog)
      }, 5)
    },
    positionAdminDialog() {
      const event = this.lastClickEvent
      let targetElement = event.target
      event.path.forEach((el) => {
        if (el.tagName === 'A') {
          targetElement = el
        }
      })
      const boundingBox = targetElement.getBoundingClientRect()
      const position = {
        top: boundingBox.top + boundingBox.height,
        left: boundingBox.left + boundingBox.width / 2
      }
      console.log(targetElement.width, position)
      this.$cwa.$eventBus.$emit('cwa:admin-dialog:position', position)
    },
    getCollectionResourceByLocation(location, locationResourceId) {
      const ComponentCollection = this.$cwa.resources?.ComponentCollection
      if (!ComponentCollection) {
        return
      }
      for (const id in ComponentCollection.byId) {
        const resource = ComponentCollection.byId[id]
        if (resource && resource.location === location && resource[this.locationResourceType].indexOf(locationResourceId) !== -1) {
          return resource
        }
      }
      return null
    },
    async addComponentCollection() {
      this.startApiRequest()
      try {
        await this.$cwa.createResource('/_/component_collections', {
          reference: `${this.locationResourceReference}_${this.location}`,
          location: this.location,
          [this.locationResourceType]: [this.locationResourceId]
        })
      } catch (err) {
        this.handleApiError(err)
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
    // async displayComponents() {
    //   this.showComponentsList = true
    // },
    // componentAdded() {
    //   this.showComponentsList = false
    //   this.reloadCollection()
    // },
    // async reloadCollection() {
    //   this.reloading = true
    //   await this.$cwa.fetcher.fetchComponentCollection(this.resource['@id'])
    //   this.reloading = false
    // },
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

<style lang="sass">
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
  &.is-empty
    &.is-editing
      border: 1px dashed $cwa-grid-item-border-color
    &:not(.is-editing)
      display: none
  .add-button-holder
    display: flex
    justify-content: center
    padding: 2rem
</style>
