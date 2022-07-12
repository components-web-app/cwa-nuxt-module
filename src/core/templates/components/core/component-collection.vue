<template>
  <!-- if the collection exists -->
  <div
    v-if="resource"
    :class="[
      {
        'is-editing': $cwa.isEditMode
        // 'is-empty': !sortedComponentPositions.length
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
      class="positions-container"
      :group="`collection-${iri}`"
      @change="draggableChanged"
    >
      <component-position
        v-for="positionIri in sortedComponentPositions"
        :key="positionIri"
        :class="[isDraggable ? 'is-draggable' : null]"
        :show-sort="showOrderValues"
        :iri="positionIri"
      />
      <component
        :is="newComponentName"
        v-if="newComponentResource"
        :iri="newComponentIri"
        @initial-data="handleInitialData"
      />
    </draggable>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import slugify from 'slugify'
import Draggable from 'vuedraggable'
import NewComponentMixin from '../../../mixins/NewComponentMixin'
import ApiRequestMixin from '../../../mixins/ApiRequestMixin'
import {
  ComponentManagerMixin,
  ComponentManagerComponent
} from '../../../mixins/ComponentManagerMixin'
import {
  COMPONENT_MANAGER_EVENTS,
  DraggableEvent,
  NewComponentEvent,
  TabChangedEvent
} from '../../../events'
import ComponentPosition from '@cwa/nuxt-module/core/templates/components/core/component-position.vue'
import components from '~/.nuxt/cwa/components'

export default Vue.extend({
  components: {
    ComponentPosition,
    Draggable,
    ComponentLoadError: () => import('./component-load-error.vue'),
    CwaAddButton: () => import('../utils/cwa-add-button.vue'),
    ...components
  },
  mixins: [ApiRequestMixin, ComponentManagerMixin, NewComponentMixin],
  props: {
    // could be layout page or component
    location: {
      type: String,
      required: true
    },
    // could be layout iri, page iri or component iri
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
      isDraggable: false,
      showOrderValues: false
    }
  },
  computed: {
    iri() {
      return this.resource?.['@id']
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
            label: 'Add Dynamic Placeholder',
            component: () =>
              import(
                '../admin/cwa-component-manager/tabs/component-collection/position.vue'
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
      return this.$cwa.$storage.getCollectionByPlacement({
        iri: this.locationResourceId,
        name: this.location
      })
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
        const positions = []
        for (const iri of this.resource.componentPositions) {
          const position = this.$cwa.resources?.ComponentPosition?.byId[iri]
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
    }
  },
  watch: {
    // we cannot add a click event if this component does not exist
    // and it will not if there is no resource.
    resource(newValue, oldValue) {
      if (newValue && !oldValue) {
        this.$nextTick(() => {
          this.initCMMixin()
        })
      }
    }
  },
  async mounted() {
    if (!this.resource && this.$cwa.isAdmin) {
      await this.addComponentCollection()
    }
    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.newComponent,
      this.setNewComponentEvent
    )
    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.newComponentCleared,
      this.setNewComponentEvent
    )
    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.draggable,
      this.handleDraggableEvent
    )
    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.tabChanged,
      this.handleTabChangedEvent
    )
    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.hide,
      this.handleManagerCloseEvent
    )
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.newComponent,
      this.setNewComponentEvent
    )
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.newComponentCleared,
      this.setNewComponentEvent
    )
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.draggable,
      this.handleDraggableEvent
    )
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.tabChanged,
      this.handleTabChangedEvent
    )
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.hide,
      this.handleManagerCloseEvent
    )
  },
  methods: {
    setNewComponentEvent(event: NewComponentEvent) {
      if (!event || event.collection !== this.resource['@id']) {
        // if we had been adding one here, it was added and another is being added elsewhere we clear it...
        this.newComponentEvent = null
        return
      }

      this.newComponentEvent = event
    },
    handleManagerCloseEvent() {
      this.showOrderValues = false
    },
    handleTabChangedEvent(event: TabChangedEvent) {
      this.isDraggable = false
      if (
        !event.context?.collection.iri ||
        event.context?.collection.iri !== this.resource['@id']
      ) {
        this.showOrderValues = false
      } else {
        this.showOrderValues = !!event.newTab?.context?.showOrderValues
      }
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
  > .positions-container > .is-draggable
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
      animation-name: cwa-manager-primary-highlight-before-animation
    &::after
      animation-name: cwa-manager-primary-highlight-after-animation
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
