<template>
  <!-- if the collection exists -->
  <div
    v-if="resource"
    :class="[
      {
        'is-editing': $cwa.isEditMode,
        'is-empty': !sortedComponentPositions.length
      },
      ...classes
    ]"
  >
    <!-- if there are no components -->
    <client-only v-if="$cwa.isEditMode">
      <component-load-error
        v-if="!sortedComponentPositions.length && !this.newComponentEvent"
      >
        <div class="add-button-holder">
          <cwa-add-button :highlight="true" />
        </div>
      </component-load-error>
    </client-only>
    <!-- else we loop through components -->
    <component
      :is="$cwa.isEditMode ? 'div' : 'div'"
      v-model="sortedComponentPositions"
      :group="`collection-${resource['@id']}`"
      @change="draggableChanged"
    >
      <component-position
        v-for="iri in sortedComponentPositions"
        :key="iri"
        :iri="iri"
      />
      <component
        :is="newComponentEvent.component"
        v-if="newComponentIri"
        :iri="newComponentIri"
      />
    </component>
  </div>
</template>

<script lang="ts">
import slugify from 'slugify'
import ComponentPosition from '@cwa/nuxt-module/core/templates/components/core/component-position.vue'
import ApiRequestMixin from '@cwa/nuxt-module/core/mixins/ApiRequestMixin'
import {
  ComponentManagerMixin,
  ComponentManagerComponent
} from '@cwa/nuxt-module/core/mixins/ComponentManagerMixin'
import { COMPONENT_MANAGER_EVENTS } from '../../../events'
import { NewComponentEvent } from '../admin/cwa-component-manager/types'

export default {
  components: {
    CwaAddButton: () => import('../utils/cwa-add-button.vue'),
    ComponentPosition,
    ComponentLoadError: () => import('./component-load-error.vue'),
    Draggable: () => import('vuedraggable')
  },
  mixins: [ApiRequestMixin, ComponentManagerMixin],
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
    locationResourceType: {
      type: String,
      required: true,
      validate(value) {
        return ['pages', 'layouts', 'components'].includes(value)
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
      newComponentEvent: null
    }
  },
  computed: {
    componentManager(): ComponentManagerComponent {
      return {
        name: 'Collection',
        tabs: [
          {
            label: 'Add Component',
            component: () =>
              import(
                '../admin/cwa-component-manager/tabs/component-collection/component.vue'
              )
          },
          {
            label: 'Info',
            component: () =>
              import(
                '../admin/cwa-component-manager/tabs/component-collection/info.vue'
              )
          }
        ]
      }
    },
    resource() {
      return this.getCollectionResourceByLocation(
        this.location,
        this.locationResourceId
      )
    },
    classes() {
      return [
        'component-collection',
        this.resource
          ? [
              this.resource.location,
              slugify(this.resource.reference, {
                lower: true
              })
            ]
          : 'not-found',
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
        return positions
          .sort((a, b) => (a.sortValue > b.sortValue ? 1 : -1))
          .map(({ '@id': id }) => id)
      },
      set(newIriArray) {
        this.previousSortedComponentPositions = []
        this.sortedComponentPositions.forEach((iri) => {
          this.previousSortedComponentPositions.push({
            iri,
            sortValue: this.$cwa.resources.ComponentPosition.byId[iri].sortValue
          })
        })

        for (const [index, iri] of newIriArray.entries()) {
          const position = this.$cwa.resources.ComponentPosition.byId[iri]
          const newPosition = Object.assign({}, position, { sortValue: index })
          this.$cwa.saveResource(newPosition)
        }
      }
    },
    newComponentIri() {
      return this.newComponentEvent
        ? `${this.newComponentEvent.endpoint}/new`
        : null
    }
  },
  watch: {
    newComponentEvent(event) {
      if (!event) {
        // should we remove the data or keep it in case we want to continue adding??
        // if we keep then the below 'setResource' call will need to be enhanced so as to not override
        return
      }
      this.$cwa.$storage.setResource({
        resource: {
          '@id': this.newComponentIri,
          '@type': event.name
        }
      })
    }
  },
  async mounted() {
    if (!this.resource && this.$cwa.isAdmin) {
      await this.addComponentCollection()
    }
    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.newComponent,
      this.handleNewComponentEvent
    )
    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.selectComponent,
      this.handleSelectComponentEvent
    )
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.newComponent,
      this.handleNewComponentEvent
    )
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.selectComponent,
      this.handleSelectComponentEvent
    )
  },
  methods: {
    handleSelectComponentEvent(iri?: string) {
      if (this.newComponentEvent && this.newComponentIri !== iri) {
        this.newComponentEvent = null
      }
    },
    handleNewComponentEvent(event: NewComponentEvent) {
      if (event.collection !== this.resource['@id']) {
        return
      }

      this.newComponentEvent = event
    },
    getCollectionResourceByLocation(location, locationResourceId) {
      const ComponentCollection = this.$cwa.resources?.ComponentCollection
      if (!ComponentCollection) {
        return
      }
      for (const resource of Object.values(ComponentCollection.byId) as {
        location?: string
      }[]) {
        if (
          resource &&
          resource.location === location &&
          resource[this.locationResourceType].includes(locationResourceId)
        ) {
          return resource
        }
      }
      return null
    },
    async addComponentCollection() {
      this.startApiRequest()
      try {
        await this.$cwa.createResource(
          '/_/component_collections',
          {
            reference: `${this.locationResourceReference}_${this.location}`,
            location: this.location,
            [this.locationResourceType]: [this.locationResourceId]
          },
          null,
          [this.locationResourceId]
        )
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
    async draggableChanged({ moved }) {
      this.reloading = true
      const previousPosition = this.previousSortedComponentPositions[
        moved.newIndex
      ]
      await this.$cwa.updateResource(moved.element, {
        sortValue: previousPosition.sortValue
      })
      this.previousSortedComponentPositions = null
      this.reloading = false
    }
  }
}
</script>

<style lang="sass">
@keyframes cwa-manager-highlight-before-animation-collection
  0%
    opacity: 0
    width: calc(100% - 10px)
    height: calc(100% - 10px)
    box-shadow: none
  40%
    opacity: 1
    box-shadow: 0 0 14px  $cwa-color-primary
    width: 100%
    height: 100%
  80%
    opacity: 0
    box-shadow: 0 0 20px 0 $cwa-color-primary
    width: calc(100% + 4px)
    height: calc(100% + 4px)
  100%
    opacity: 0
    width: calc(100% + 4px)
    height: calc(100% + 4px)
    box-shadow: none

@keyframes cwa-manager-highlight-after-animation-collection
  0%
    opacity: 0
    width: 100%
    height: 100%
    box-shadow: none
  40%
    opacity: 1
    width: calc(100% - 5px)
    height: calc(100% - 5px)
    box-shadow: inset 0 0 1px 0 $cwa-color-primary, 0 0 2px 0 $cwa-color-primary, 0 0 4px 0 $cwa-color-primary
  80%
    opacity: 0
    width: calc(100% - 5px)
    height: calc(100% - 5px)
    box-shadow: inset 0 0 10px 0 $cwa-color-primary, 0 0 2px 0 $cwa-color-primary, 0 0 2px 0 $cwa-color-primary
  100%
    opacity: 0
    width: calc(100% - 5px)
    height: calc(100% - 5px)
    box-shadow: none

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
    &:not(.is-editing)
      display: none
  .add-button-holder
    display: flex
    justify-content: center
    padding: 2rem
  > .cwa-manager-highlight
    &::before
      animation-name: cwa-manager-highlight-before-animation-collection
    &::after
      animation-name: cwa-manager-highlight-after-animation-collection
</style>
