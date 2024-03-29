<template>
  <client-only v-if="$cwa.isAdmin">
    <div class="cwa-component-manager-holder" @click.stop>
      <div
        class="cwa-components-manager is-placeholder"
        :style="{ height: `${elementHeight}` }"
      />
      <transition-expand
        @after-enter="showTabs = true"
        @after-leave="showTabs = false"
      >
        <div v-show="isShowing" ref="cwaManager" class="cwa-components-manager">
          <div class="inner">
            <div v-if="!selectedComponent">
              <div>No component selected</div>
            </div>
            <template v-else>
              <div class="top row">
                <div class="column">
                  <div v-if="cloneComponent" class="clone-info">
                    <p>Select where you would like to clone this component</p>
                    <cwa-admin-toggle
                      id="cwa-cm-clone-navigate"
                      v-model="cloneNavigate"
                      label="Navigate"
                    />
                  </div>
                  <tabs
                    v-show="!cloneComponent"
                    :tabs="componentTabs"
                    :iri="componentIri"
                    :selected-position="selectedPosition"
                    :collection="closestCollection"
                    :show-tabs="showTabs && !cloneComponent"
                    @draggable="toggleDraggable"
                    @close="hide"
                  />
                </div>
              </div>
            </template>
          </div>
        </div>
      </transition-expand>
    </div>
  </client-only>
</template>

<script lang="ts">
import Vue from 'vue'
import consola from 'consola'
import HeightMatcherMixin from '../../../mixins/HeightMatcherMixin'
import {
  ComponentTabContext,
  ComponentManagerTab,
  EVENTS,
  StatusTabContext
} from '../../../mixins/ComponentManagerMixin'
import TransitionExpand from '../utils/transition-expand.vue'
import {
  NOTIFICATION_EVENTS,
  STATUS_EVENTS,
  ResetStatusEvent,
  DraggableEvent,
  API_EVENTS,
  ComponentManagerAddEvent,
  SaveStateEvent,
  PublishableToggledEvent,
  HighlightComponentEvent
} from '../../../events'
import CloneComponentMixin from '../../../mixins/CloneComponentMixin'
import CwaAdminToggle from './input/cwa-admin-toggle.vue'
import Tabs from './cwa-component-manager/tabs.vue'

interface DataInterface {
  expanded: boolean
  components: Array<ComponentManagerAddEvent>
  pendingComponents: Array<ComponentManagerAddEvent>
  savedStatus: Number
  showHighlightOverlay: boolean
  showTabs: boolean
  selectedPosition?: string
  mouseDownPosition: {
    pageX: Number
    pageY: Number
  }
  persistentStates: { [key: string]: { [key: string]: any } }
}

export default Vue.extend({
  components: {
    CwaAdminToggle,
    Tabs,
    TransitionExpand
  },
  mixins: [HeightMatcherMixin('cwaManager'), CloneComponentMixin],
  data(): DataInterface {
    return {
      expanded: false,
      components: [],
      pendingComponents: [],
      savedStatus: 99, // 0 orange, 1 green, -1 danger
      showHighlightOverlay: false,
      showTabs: false,
      selectedPosition: null,
      mouseDownPosition: null,
      persistentStates: {}
    }
  },
  computed: {
    showingCriteria() {
      return this.$cwa.isEditMode
    },
    isShowing() {
      return this.showingCriteria && this.expanded && this.components.length
    },
    selectedComponent(): ComponentManagerAddEvent | null {
      return this.components?.[0] || null
    },
    componentData() {
      return this.selectedComponent?.data
    },
    componentTabs() {
      return [...(this.componentData?.tabs || []), ...this.dynamicTabs]
    },
    componentIri() {
      const selectedComponent = this.selectedComponent
      if (!selectedComponent) {
        return null
      }
      return this.$cwa.getPublishableIri(selectedComponent.iri)
    },
    selectedContext() {
      return this.selectedComponent.data.context || {}
    },
    dynamicTabs() {
      const dynamicTabs = []

      const addTab = (tabObj) => {
        if (!tabObj) {
          return
        }
        dynamicTabs.push(tabObj)
      }

      const componentTabContext = this.selectedContext.componentTab
      if (componentTabContext) {
        addTab(this.getComponentTab(componentTabContext))
      }

      const statusTabContext = this.selectedContext.statusTab
      if (statusTabContext) {
        addTab(this.getStatusTab(statusTabContext))
      }

      return dynamicTabs
    },
    closestCollection() {
      for (const component of this.components) {
        if (this.isIriCollection(component.iri)) {
          return component
        }
      }
      return null
    }
  },
  watch: {
    isShowing(newValue) {
      this.$cwa.$eventBus.$emit(EVENTS.showing, newValue)
      if (!newValue) {
        this.toggleComponent(null, null)
        if (this.expanded) {
          this.expanded = false
        }
      }
    },
    selectedComponent({ iri }) {
      this.toggleComponent(iri || null, this.selectedPosition || null)
    },
    // selectedPosition(iri) {
    //   this.toggleComponent(this.selectedComponent.iri || null, iri || null)
    // },
    persistentStates: {
      handler(newValue) {
        this.$cwa.$storage.setState(
          'CwaComponentManagerStates',
          JSON.parse(JSON.stringify(newValue))
        )
      },
      deep: true
    },
    components: {
      handler(newComponents) {
        this.$cwa.$eventBus.$emit(EVENTS.componentsInitialised, newComponents)
      }
    },
    componentIri(newComponentIri) {
      this.$cwa.$eventBus.$emit(EVENTS.selectedComponentIri, newComponentIri)
    }
  },
  mounted() {
    this.persistentStates = {}
    window.addEventListener('mousedown', this.handleMouseDown)
    window.addEventListener('click', this.show)
    this.$cwa.$eventBus.$on(EVENTS.selectPosition, this.selectPositionListener)
    this.$cwa.$eventBus.$on(EVENTS.addComponent, this.addComponent)
    this.$cwa.$eventBus.$on(EVENTS.saveState, this.saveStateListener)
    this.$cwa.$eventBus.$on(
      EVENTS.publishableToggled,
      this.publishableToggledListener
    )
    this.$cwa.$eventBus.$on(API_EVENTS.newDraft, this.newDraftListener)
  },
  beforeDestroy() {
    window.removeEventListener('mousedown', this.handleMouseDown)
    window.removeEventListener('click', this.show)
    this.$cwa.$eventBus.$off(EVENTS.selectPosition, this.selectPositionListener)
    this.$cwa.$eventBus.$off(EVENTS.addComponent, this.addComponent)
    this.$cwa.$eventBus.$off(EVENTS.saveState, this.saveStateListener)
    this.$cwa.$eventBus.$off(
      EVENTS.publishableToggled,
      this.publishableToggledListener
    )
    this.$cwa.$eventBus.$off(API_EVENTS.newDraft, this.newDraftListener)
    this.$cwa.$eventBus.$emit(EVENTS.showing, false)
  },
  methods: {
    handleMouseDown({ pageX, pageY }) {
      this.mouseDownPosition = {
        pageX,
        pageY
      }
    },
    newDraftListener({ publishedIri, draftIri }) {
      if (draftIri && publishedIri === this.componentIri) {
        this.$nextTick(() => {
          this.$cwa.$eventBus.$emit(EVENTS.selectComponent, draftIri)
        })
        this.copyState(publishedIri, draftIri)
      }
    },
    isIriCollection(iri) {
      return this.$cwa.$storage.getTypeFromIri(iri) === 'ComponentCollection'
    },
    selectPositionListener(iri) {
      this.selectPosition(iri)
    },
    selectPosition(iri) {
      this.selectedPosition = iri
      if (this.cloneComponent) {
        this.cloneDestination = iri
      }
    },
    toggleDraggable(isDraggable) {
      this.$cwa.$eventBus.$emit(EVENTS.draggable, {
        isDraggable,
        collection: this.closestCollection.iri
      } as DraggableEvent)
    },
    getStatusTab(
      statusTabContext: StatusTabContext
    ): ComponentManagerTab | null {
      if (!statusTabContext.enabled) {
        return null
      }
      return {
        label: 'Publish',
        component: async () =>
          await import(
            '@cwa/nuxt-module/core/templates/components/admin/cwa-component-manager/tabs/component/publishable-status.vue'
          ),
        priority: 100,
        context: statusTabContext
      }
    },
    getComponentTab(
      componentTabContext: ComponentTabContext
    ): ComponentManagerTab | null {
      if (
        !componentTabContext.UiClassNames ||
        !componentTabContext.UiClassNames.length ||
        !componentTabContext.UiComponents ||
        !componentTabContext.UiComponents.length
      ) {
        return null
      }
      return {
        label: 'Component',
        component: () =>
          import(
            '@cwa/nuxt-module/core/templates/components/admin/cwa-component-manager/tabs/component/component-ui.vue'
          ),
        priority: 0,
        context: componentTabContext
      }
    },
    toggleComponent(iri?: string, selectedPosition?: string) {
      this.$cwa.$eventBus.$emit(EVENTS.highlightComponent, {
        iri,
        selectedPosition
      } as HighlightComponentEvent)
    },
    hide() {
      if (this.cloneComponent) {
        this.cancelClone()
        return
      }
      this.$cwa.$eventBus.$emit(EVENTS.hide)
      this.expanded = false
      this.persistentStates = {}
      this.selectPosition(null)
    },
    show(event) {
      // calendar inside manager should not trigger anything
      if (event.target.closest('.flatpickr-calendar')) {
        return
      }

      // for programatic clicks do not check position
      if (event.isTrusted) {
        // prevent trigger on a drag
        const delta = 6
        const diffX = Math.abs(event.pageX - this.mouseDownPosition.pageX)
        const diffY = Math.abs(event.pageY - this.mouseDownPosition.pageY)
        if (diffX > delta && diffY > delta) {
          return
        }
      }

      this.pendingComponents = []
      if (this.showingCriteria) {
        // the component position component is listening to show to select a component.
        // we could be selecting something without a position.
        this.$cwa.$eventBus.$emit(EVENTS.selectPosition, null)

        // this event is listened so components can send events for cwa manager to listen to and populate pending components
        this.$cwa.$eventBus.$emit(EVENTS.show)
      }

      // the show event above should be listened to and add-component event emitted to populate components by now
      if (!this.pendingComponents.length) {
        this.hide()
        consola.info('Not showing components manager. No menu data populated.')
        return
      }
      if (!this.selectedPosition && this.cloneComponent) {
        for (const component of this.pendingComponents) {
          if (component.data.name === 'Collection') {
            this.cloneDestination = component.iri
            break
          }
        }
      }

      this.components = this.pendingComponents
      this.$nextTick(() => {
        this.$cwa.$eventBus.$emit(
          NOTIFICATION_EVENTS.clear,
          'components-manager'
        )

        this.$cwa.$eventBus.$emit(STATUS_EVENTS.reset, {
          category: 'components-manager'
        } as ResetStatusEvent)

        this.$nextTick(() => {
          this.$cwa.$eventBus.$emit(EVENTS.showing, this.showingCriteria)
          if (!this.showingCriteria) {
            this.hide()
          } else {
            this.expanded = true
          }
        })
      })
    },
    addComponent({ data, iri }: ComponentManagerAddEvent) {
      this.pendingComponents.push({ data, iri })
    },
    saveStateListener(event: SaveStateEvent) {
      if (!this.showingCriteria) {
        return
      }
      if (!this.persistentStates?.[event.iri]) {
        this.$set(this.persistentStates, event.iri, {})
      }
      try {
        this.$set(this.persistentStates[event.iri], event.name, event.value)
      } catch (error) {
        consola.error('ERROR SAVING CM PERSISTENT STATE (CMVALUE)')
        consola.error(error)
        consola.error(event.iri, event.name, event.value)
      }
    },
    publishableToggledListener(event: PublishableToggledEvent) {
      if (event.showPublished) {
        this.copyState(event.draftIri, event.publishedIri)
      } else {
        this.copyState(event.publishedIri, event.draftIri)
      }
    },
    copyState(fromIri, toIri) {
      if (!this.persistentStates[fromIri]) {
        return
      }
      const copyData = JSON.parse(
        JSON.stringify(this.persistentStates[fromIri])
      )
      this.$set(this.persistentStates, toIri, copyData)
      this.$delete(this.persistentStates, fromIri)
    }
  }
})
</script>

<style lang="sass">
@keyframes cwa-manager-highlight-before-animation
  0%
    opacity: 0
    width: calc(100% - 2px)
    height: calc(100% - 2px)
    box-shadow: none
  40%
    opacity: 1
    box-shadow: 0 0 4px 0 $cwa-success
    width: 100%
    height: 100%
  80%
    opacity: 0
    box-shadow: 0 0 8px 0 $cwa-success
    width: calc(100% + 6px)
    height: calc(100% + 6px)
  100%
    opacity: 0
    box-shadow: 0 0 8px 0 $cwa-success
    width: calc(100% + 6px)
    height: calc(100% + 6px)

@keyframes cwa-manager-highlight-after-animation
  0%
    opacity: 0
    width: 100%
    height: 100%
    box-shadow: none
  40%
    opacity: 1
    width: calc(100% - 5px)
    height: calc(100% - 5px)
    box-shadow: inset 0 0 1px 0 $cwa-success, 0 0 2px 0 $cwa-success, 0 0 4px 0 $cwa-success
  80%
    opacity: 0
    width: calc(100% - 5px)
    height: calc(100% - 5px)
    box-shadow: inset 0 0 10px 0 $cwa-success, 0 0 2px 0 $cwa-success, 0 0 2px 0 $cwa-success
  100%
    opacity: 0
    width: calc(100% - 5px)
    height: calc(100% - 5px)
    box-shadow: inset 0 0 10px 0 $cwa-success, 0 0 2px 0 $cwa-success, 0 0 2px 0 $cwa-success

@keyframes cwa-manager-draft-highlight-before-animation
  0%
    opacity: 0
    width: calc(100% - 2px)
    height: calc(100% - 2px)
    box-shadow: none
  40%
    opacity: 1
    box-shadow: 0 0 4px 0 $cwa-warning
    width: 100%
    height: 100%
  80%
    opacity: 0
    box-shadow: 0 0 8px 0 $cwa-warning
    width: calc(100% + 6px)
    height: calc(100% + 6px)
  100%
    opacity: 0
    box-shadow: 0 0 8px 0 $cwa-warning
    width: calc(100% + 6px)
    height: calc(100% + 6px)

@keyframes cwa-manager-draft-highlight-after-animation
  0%
    opacity: 0
    width: 100%
    height: 100%
    box-shadow: none
  40%
    opacity: 1
    width: calc(100% - 5px)
    height: calc(100% - 5px)
    box-shadow: inset 0 0 1px 0 $cwa-warning, 0 0 2px 0 $cwa-warning, 0 0 4px 0 $cwa-color-primary
  80%
    opacity: 0
    width: calc(100% - 5px)
    height: calc(100% - 5px)
    box-shadow: inset 0 0 10px 0 $cwa-warning, 0 0 2px 0 $cwa-warning, 0 0 2px 0 $cwa-color-primary
  100%
    opacity: 0
    width: calc(100% - 5px)
    height: calc(100% - 5px)
    box-shadow: inset 0 0 10px 0 $cwa-warning, 0 0 2px 0 $cwa-warning, 0 0 2px 0 $cwa-color-primary

@keyframes cwa-manager-primary-highlight-before-animation
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

@keyframes cwa-manager-primary-highlight-after-animation
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


@keyframes cwa-manager-gray-highlight-before-animation
  0%
    opacity: 0
    width: calc(100% - 10px)
    height: calc(100% - 10px)
    box-shadow: none
  40%
    opacity: 1
    box-shadow: 0 0 14px  $cwa-color-quaternary
    width: 100%
    height: 100%
  80%
    opacity: 0
    box-shadow: 0 0 20px 0 $cwa-color-quaternary
    width: calc(100% + 4px)
    height: calc(100% + 4px)
  100%
    opacity: 0
    width: calc(100% + 4px)
    height: calc(100% + 4px)
    box-shadow: none

@keyframes cwa-manager-gray-highlight-after-animation
  0%
    opacity: 0
    width: 100%
    height: 100%
    box-shadow: none
  40%
    opacity: 1
    width: calc(100% - 5px)
    height: calc(100% - 5px)
    box-shadow: inset 0 0 1px 0 $cwa-color-quaternary, 0 0 2px 0 $cwa-color-quaternary, 0 0 4px 0 $cwa-color-quaternary
  80%
    opacity: 0
    width: calc(100% - 5px)
    height: calc(100% - 5px)
    box-shadow: inset 0 0 10px 0 $cwa-color-quaternary, 0 0 2px 0 $cwa-color-quaternary, 0 0 2px 0 $cwa-color-quaternary
  100%
    opacity: 0
    width: calc(100% - 5px)
    height: calc(100% - 5px)
    box-shadow: none

=absolute-overlay
  position: absolute
  top: 50%
  left: 50%
  width: 100%
  height: 100%
  transform: translate3d(-50%, -50%, 0)
  pointer-events: none
  backface-visibility: hidden

.cwa-manager-highlight
  +absolute-overlay
  &::before
    +absolute-overlay
    content: ''
    animation: cwa-manager-highlight-before-animation 1.5s infinite linear
  &::after
    +absolute-overlay
    content: ''
    animation: cwa-manager-highlight-after-animation 1.5s infinite linear
    animation-delay: .2s
  &.is-draft
    &::before
      animation-name: cwa-manager-draft-highlight-before-animation
    &::after
      animation-name: cwa-manager-draft-highlight-after-animation
  &.is-primary
    &::before
      animation-name: cwa-manager-primary-highlight-before-animation
    &::after
      animation-name: cwa-manager-primary-highlight-after-animation
  &.is-gray
    &::before
      animation-name: cwa-manager-gray-highlight-before-animation
    &::after
      animation-name: cwa-manager-gray-highlight-after-animation

.highlight-component-only
  .cwa-manager-highlight
    &::before
      animation-name: cwa-manager-gray-highlight-before-animation
    &::after
      animation-name: cwa-manager-gray-highlight-after-animation

.hide-nested-cwa-manager-highlight
  .cwa-manager-highlight
      display: none

.cwa-components-manager
  position: relative
  background: $cwa-navbar-background
  color: $cwa-color-text-light
  z-index: 100
  &:not(.is-placeholder)
    position: fixed
    bottom: 0
    left: 0
    width: 100%
  .clone-info
    padding: 2rem
    p
      color: $white
      font-size: 1.8rem
  a
    color: $cwa-color-text-light
    &:hover,
    .is-active
      color: $white
  .button
    +cwa-control
    margin-bottom: 0
    &:hover
      color: $white
  .top.row
    padding: 1rem
</style>
