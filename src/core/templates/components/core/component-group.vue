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
      :class="groupClassNames"
      :group="`collection-${iri}`"
      @change="draggableChanged"
    >
      <component-position
        v-for="positionIri in sortedComponentPositions"
        :key="positionIri"
        :class="positionClassNames"
        :show-sort="showOrderValues"
        :iri="positionIri"
      />
      <div v-if="newComponentResource" :class="positionClassNames">
        <component
          :is="newComponentName"
          :iri="newComponentIri"
          @initialData="handleInitialData"
        />
      </div>
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
import PageResourceUtilsMixin from '@cwa/nuxt-module/core/mixins/PageResourceUtilsMixin'

export default Vue.extend({
  components: {
    ComponentPosition,
    Draggable,
    ComponentLoadError: () => import('./component-load-error.vue'),
    CwaAddButton: () => import('../utils/cwa-add-button.vue'),
    ...components
  },
  mixins: [
    ApiRequestMixin,
    ComponentManagerMixin,
    NewComponentMixin,
    PageResourceUtilsMixin
  ],
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
    },
    allowedComponents: {
      type: Array,
      default: null,
      required: false
    },
    groupClass: {
      type: Array,
      default: null,
      required: false
    },
    positionClass: {
      type: Array,
      default: null,
      required: false
    }
  },
  data() {
    return {
      reloading: false,
      previousSortedComponentPositions: null,
      isDraggable: false,
      showOrderValues: false,
      componentManagerDisabled: true
    }
  },
  computed: {
    positionClassNames() {
      const classes = this.positionClass || []
      if (this.isDraggable) {
        classes.push('is-draggable')
      }
      return classes
    },
    groupClassNames() {
      return ['positions-container', ...(this.groupClass || [])]
    },
    iri() {
      return this.resource?.['@id']
    },
    componentManager(): ComponentManagerComponent {
      return {
        name: 'Component Group',
        tabs: [
          {
            label: 'Add Component',
            component: () =>
              import(
                '../admin/cwa-component-manager/tabs/component-group/component.vue'
              )
          },
          {
            label: 'Add Dynamic Placeholder',
            component: () =>
              import(
                '../admin/cwa-component-manager/tabs/component-group/position.vue'
              )
          },
          {
            label: 'Info',
            component: () =>
              import(
                '../admin/cwa-component-manager/tabs/component-group/info.vue'
              )
          }
        ]
      }
    },
    resource() {
      return this.$cwa.$storage.getGroupByPlacement({
        iri: this.locationResourceId,
        name: this.location
      })
    },
    classes() {
      return [
        'component-group',
        `is-cwa-collection-${this.locationResourceType}`,
        this.resource
          ? [
              `cwa-group-${this.resource.location}`,
              'cwa-group-' +
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
    if (!this.isDynamicPage) {
      this.componentManagerDisabled = false
      this.initCMMixin()
    }
    if (this.$cwa.isAdmin) {
      if (!this.resource) {
        await this.addComponentGroup()
      } else {
        await this.validateComponentGroup()
      }
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
        event.context?.collection === null ||
        event.context?.collection !== this.resource['@id']
      ) {
        this.showOrderValues = false
      } else {
        this.showOrderValues = !!event.newTab?.context?.showOrderValues
      }
    },
    async validateComponentGroup() {
      const arrayCompare = (a1, a2) => {
        if (!Array.isArray(a1)) {
          a1 = []
        }
        if (!Array.isArray(a2)) {
          a2 = []
        }
        let i = a1.length
        if (i !== a2.length) {
          return false
        }
        while (i--) {
          if (a1[i] !== a2[i]) return false
        }
        return true
      }
      if (
        !arrayCompare(this.resource.allowedComponents, this.allowedComponents)
      ) {
        this.startApiRequest()
        try {
          await this.$cwa.updateResource(this.resource['@id'], {
            allowedComponents: this.allowedComponents
          })
        } catch (err) {
          this.handleApiError(err)
        }
        this.completeApiRequest()
      }
    },
    async addComponentGroup() {
      this.startApiRequest()
      try {
        await this.$cwa.createResource(
          '/_/component_groups',
          {
            reference: `${this.locationResourceReference}_${this.location}`,
            location: this.location,
            [this.locationResourceType]: [this.locationResourceId],
            allowedComponents: this.allowedComponents
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

.component-group
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
    &:not(.is-wide)::before
      animation-name: cwa-manager-primary-highlight-before-animation
    &::after
      animation-name: cwa-manager-primary-highlight-after-animation
  .cwa-sort-value
    pointer-events: none
    position: absolute
    top: 0
    right: 0
    font:
      size: .9rem
      weight: $weight-semibold
    color: $white
    background: rgba($cwa-background-dark, .8)
    border-radius: 2rem
    min-width: 2rem
    height: 2rem
    display: flex
    align-items: center
    justify-content: center
    line-height: 2rem
    padding: 0 .25rem
    overflow: hidden
</style>
