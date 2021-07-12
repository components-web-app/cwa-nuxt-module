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
        v-if="!sortedComponentPositions.length && !newComponentEvent"
      >
        <div class="add-button-holder">
          <cwa-add-button :highlight="true" />
        </div>
      </component-load-error>
    </client-only>
    <!-- else we loop through components -->
    <draggable
      v-model="sortedComponentPositions"
      handle=".is-draggable"
      class="position-container"
      :group="`collection-${resource['@id']}`"
      @change="draggableChanged"
    >
      <component-position
        v-for="iri in sortedComponentPositions"
        :key="iri"
        :class="[isDraggable ? 'is-draggable' : null, 'component-position']"
        :show-sort="showOrderValues"
        :iri="iri"
      />
      <component
        :is="newComponentName"
        v-if="newComponentIri"
        :iri="newComponentIri"
      />
    </draggable>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import slugify from 'slugify'
import ComponentPosition from '@cwa/nuxt-module/core/templates/components/core/component-position.vue'
import Draggable from 'vuedraggable'
import ApiRequestMixin from '../../../mixins/ApiRequestMixin'
import {
  ComponentManagerMixin,
  ComponentManagerComponent
} from '../../../mixins/ComponentManagerMixin'
import {
  COMPONENT_MANAGER_EVENTS,
  ComponentManagerAddEvent,
  DraggableEvent,
  NewComponentEvent,
  TabChangedEvent
} from '../../../events'
import components from '~/.nuxt/cwa/components'

export default Vue.extend({
  components: {
    ComponentPosition,
    Draggable,
    ComponentLoadError: () => import('./component-load-error.vue'),
    CwaAddButton: () => import('../utils/cwa-add-button.vue'),
    ...components
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
      validator(value: any): boolean {
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
      newComponentEvent: null,
      isDraggable: false,
      showOrderValues: false
    }
  },
  computed: {
    newComponentResource() {
      if (!this.newComponentIri) {
        return null
      }
      return this.$cwa.getResource(this.newComponentIri)
    },
    newComponentName() {
      const componentName =
        this.newComponentResource.uiComponent ||
        this.newComponentResource['@type']
      if (!componentName) {
        return null
      }
      return `CwaComponents${componentName}`
    },
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
      set(newIriArray: string[]) {
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
      return this.newComponentEvent?.iri || null
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
      COMPONENT_MANAGER_EVENTS.highlightComponent,
      this.handleHighlightComponentEvent
    )
    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.draggable,
      this.handleDraggableEvent
    )
    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.tabChanged,
      this.handleTabChangedEvent
    )
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.newComponent,
      this.handleNewComponentEvent
    )
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.highlightComponent,
      this.handleHighlightComponentEvent
    )
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.draggable,
      this.handleDraggableEvent
    )
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.tabChanged,
      this.handleTabChangedEvent
    )
  },
  methods: {
    handleTabChangedEvent(event: TabChangedEvent) {
      this.isDraggable = false
      this.showOrderValues = !!event.newTab.context?.showOrderValues
    },
    handleHighlightComponentEvent(iri?: string) {
      if (this.newComponentEvent && this.newComponentIri !== iri) {
        if (
          window.confirm('Are you sure you want to discard your new component?')
        ) {
          this.newComponentEvent = null
          this.$cwa.$eventBus.$emit(
            COMPONENT_MANAGER_EVENTS.newComponentCleared
          )
        } else {
          this.$cwa.$eventBus.$emit(
            COMPONENT_MANAGER_EVENTS.selectComponent,
            this.newComponentIri
          )
        }
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
      const previousPosition =
        this.previousSortedComponentPositions[moved.newIndex]
      await this.$cwa.updateResource(
        moved.element,
        {
          sortValue: previousPosition.sortValue
        },
        null,
        this.resource.componentPositions
      )
      this.previousSortedComponentPositions = null
      this.reloading = false
    },
    handleDraggableEvent(event: DraggableEvent) {
      if (!event.collection || event.collection !== this.resource['@id']) {
        return
      }
      this.isDraggable = event.isDraggable
    }
  }
})
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

@keyframes wobble-1
  0%
    transform: rotate(-.1deg)
    animation-timing-function: ease-in

  50%
    transform: rotate(.3deg)
    animation-timing-function: ease-out

@keyframes wobble-2
  0%
    transform: rotate(.1deg)
    animation-timing-function: ease-in

  50%
    transform: rotate(-.3deg)
    animation-timing-function: ease-out

.component-collection
  transition: opacity .3s
  opacity: 1
  > .position-container > .is-draggable
    &:nth-child(2n)
      animation-name: wobble-1
      animation-iteration-count: infinite
      animation-duration: .5s
      transform-origin: 50% 10%
    &:nth-child(2n-1)
      animation-name: wobble-2
      animation-iteration-count: infinite
      animation-duration: .5s
      animation-direction: alternate
      transform-origin: 30% 5%
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
  .cwa-sort-value
    pointer-events: none
    position: absolute
    top: 0
    right: 0
    font:
      size: 1.2rem
      weight: $font-weight-semi-bold
    color: $white
    background: rgba($cwa-background-dark, .8)
    border-radius: 3rem
    min-width: 3rem
    height: 3rem
    display: flex
    align-items: center
    justify-content: center
    line-height: 3rem
    padding: 0 .5rem .2rem
    overflow: hidden
</style>
