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
            <a href="#" class="done-link" @click.prevent="hide">Done</a>
            <div v-if="!selectedComponent">
              <div>No component selected</div>
            </div>
            <template v-else>
              <div class="top">
                <tabs
                  :tabs="componentTabs"
                  :iri="componentIri"
                  :selected-position="selectedPosition"
                  :collection="closestCollection"
                  :show-tabs="showTabs"
                  @draggable="toggleDraggable"
                  @close="hide"
                />
              </div>
              <div class="bottom row">
                <div v-if="showStatusTab" class="column is-narrow">
                  <publishable-icon :is-draft="isDraft" />
                </div>
                <div class="column is-narrow status-container">
                  <status-icon
                    :status="isNew ? 0 : 1"
                    category="components-manager"
                  />
                  <error-notifications
                    :listen-categories="['components-manager']"
                    :show-above="true"
                    @showing="updateNotificationsShowing"
                  />
                </div>
                <div class="column">
                  <path-breadcrumbs
                    :components="components"
                    @click="handleBreadcrumbClick"
                  />
                </div>
                <div class="column is-narrow">
                  <cwa-action-buttons
                    :selected-position="selectedPosition"
                    :selected-component="
                      selectedComponent ? selectedComponent.iri : null
                    "
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
  PublishableToggledEvent
} from '../../../events'
import PublishableIcon from './cwa-component-manager/publishable-icon.vue'
import Tabs from './cwa-component-manager/tabs.vue'
import StatusIcon from './status-icon.vue'
import ErrorNotifications from './error-notifications.vue'
import PathBreadcrumbs from './cwa-component-manager/path-breadcrumbs.vue'
import CwaActionButtons from './cwa-component-manager/cwa-action-buttons.vue'

interface DataInterface {
  expanded: boolean
  components: Array<ComponentManagerAddEvent>
  pendingComponents: Array<ComponentManagerAddEvent>
  savedStatus: Number
  warningNotificationsShowing: boolean
  showHighlightOverlay: boolean
  showTabs: boolean
  selectedPosition?: string
  persistentStates: any
  mouseDownPosition: {
    pageX: Number
    pageY: Number
  }
}

export default Vue.extend({
  components: {
    CwaActionButtons,
    PathBreadcrumbs,
    ErrorNotifications,
    StatusIcon,
    Tabs,
    PublishableIcon,
    TransitionExpand
  },
  mixins: [HeightMatcherMixin('cwaManager')],
  data(): DataInterface {
    return {
      expanded: false,
      components: [],
      pendingComponents: [],
      savedStatus: 99, // 0 orange, 1 green, -1 danger
      warningNotificationsShowing: false,
      showHighlightOverlay: false,
      showTabs: false,
      selectedPosition: null,
      persistentStates: {},
      mouseDownPosition: null
    }
  },
  computed: {
    isDraft() {
      if (!this.showStatusTab) {
        return false
      }
      if (!this.componentIri) {
        return false
      }
      const storageResource = this.$cwa.getResource(this.componentIri)
      return !!storageResource && !storageResource._metadata.published
    },
    isNew() {
      return this.componentIri && this.componentIri.endsWith('/new')
    },
    showingCriteria() {
      return this.$cwa.isEditMode
    },
    isShowing() {
      return this.showingCriteria && this.expanded && this.components.length
    },
    showStatusTab() {
      return this.componentData?.context?.statusTab?.enabled
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
        this.toggleComponent(null)
        if (this.expanded) {
          this.expanded = false
        }
      }
    },
    selectedComponent({ iri }) {
      this.toggleComponent(iri || null)
    }
  },
  mounted() {
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
    },
    toggleDraggable(isDraggable) {
      let closestCollection = null
      if (this.components) {
        for (const { iri } of this.components) {
          if (this.isIriCollection(iri)) {
            closestCollection = iri
          }
        }
      }
      this.$cwa.$eventBus.$emit(EVENTS.draggable, {
        isDraggable,
        collection: closestCollection
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
    toggleComponent(iri?: string) {
      this.$cwa.$eventBus.$emit(EVENTS.highlightComponent, { iri })
    },
    hide() {
      this.$cwa.$eventBus.$emit(EVENTS.hide)
      this.expanded = false
      this.persistentStates = {}
      this.selectPosition(null)
      this.$cwa.$storage.setState('CwaComponentManagerStates', {})
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

        this.$cwa.$eventBus.$emit(EVENTS.show)
      }
      // the show event above should be listened to and add-component event emitted to populate components by now
      if (!this.pendingComponents.length) {
        this.hide()
        consola.info('Not showing components manager. No menu data populated.')
        return
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
    updateNotificationsShowing(newValue) {
      this.warningNotificationsShowing = newValue
    },
    handleBreadcrumbClick({ componentIndex }) {
      this.components = this.components.slice(componentIndex)
      this.selectPosition(this.components[0]?.componentPositions?.[0] || null)
    },
    saveStateListener(event: SaveStateEvent) {
      if (!this.showingCriteria) {
        return
      }
      if (!this.persistentStates[event.iri]) {
        this.$set(this.persistentStates, event.iri, {})
      }
      this.$set(this.persistentStates[event.iri], event.name, event.value)
      this.$cwa.$storage.setState(
        'CwaComponentManagerStates',
        JSON.parse(
          JSON.stringify({
            ...this.persistentStates,
            [event.iri]: { ...this.persistentStates[event.iri] }
          })
        )
      )
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
      const newState = {
        ...this.persistentStates,
        [toIri]: copyData
      }
      this.$cwa.$storage.setState('CwaComponentManagerStates', newState)
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
  a
    color: $cwa-color-text-light
    &:hover,
    .is-active
      color: $white
  .button
    +cwa-control
    border-color: $cwa-color-text-light
    margin: 0
    &:hover
      color: $white
      border-color: $white
  > .inner
    > .bottom
      padding: 1.5rem
      background: $cwa-background-dark
      display: flex
      align-items: center
  .done-link
    position: absolute
    top: 0
    right: 0
    padding: 1rem
    color: inherit
  .status-container
    display: flex
</style>
