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
                <tabs :tabs="componentTabs" :resource="componentResource" />
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
              </div>
            </template>
          </div>
        </div>
      </transition-expand>
    </div>
  </client-only>
</template>

<script lang="ts">
import HeightMatcherMixin from '@cwa/nuxt-module/core/mixins/HeightMatcherMixin'
import {
  ComponentManagerAddEvent,
  ComponentTabContext,
  ComponentManagerTab,
  EVENTS
} from '@cwa/nuxt-module/core/mixins/ComponentManagerMixin'
import consola from 'consola'
import TransitionExpand from '../utils/transition-expand.vue'
import { StatusTabContext } from '../../../mixins/ComponentManagerMixin'
import {
  NOTIFICATION_EVENTS,
  STATUS_EVENTS,
  ResetStatusEvent
} from '../../../events'
import PublishableIcon from './cwa-component-manager/publishable-icon.vue'
import Tabs from './cwa-component-manager/tabs.vue'
import StatusIcon from './status-icon.vue'
import ErrorNotifications from './error-notifications.vue'
import PathBreadcrumbs from './cwa-component-manager/path-breadcrumbs.vue'

export default {
  components: {
    PathBreadcrumbs,
    ErrorNotifications,
    StatusIcon,
    Tabs,
    PublishableIcon,
    TransitionExpand
  },
  mixins: [HeightMatcherMixin('cwaManager')],
  data() {
    return {
      expanded: false,
      components: [],
      pendingComponents: [],
      savedStatus: 99, // 0 orange, 1 green, -1 danger
      warningNotificationsShowing: false,
      showHighlightOverlay: false,
      showTabs: false
    } as {
      expanded: boolean
      components: Array<ComponentManagerAddEvent>
      pendingComponents: Array<ComponentManagerAddEvent>
      savedStatus: Number
      warningNotificationsShowing: boolean
      showHighlightOverlay: boolean
      showTabs: boolean
    }
  },
  computed: {
    isDraft() {
      if (!this.showStatusTab) {
        return false
      }
      const iri = this.componentResource?.['@id']
      if (!iri) {
        return false
      }
      const storageResource = this.$cwa.getResourceIri(iri)
      return !storageResource._metadata.published
    },
    isNew() {
      return this.componentResource?.['@id'].endsWith('/new')
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
    componentResource() {
      return this.selectedComponent?.resource
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
    selectedComponent({ resource }) {
      this.toggleComponent(resource?.['@id'] || null)
    },
    showTabs(newValue) {
      this.$cwa.$eventBus.$emit(EVENTS.showTabs, newValue)
    }
  },
  mounted() {
    window.addEventListener('click', this.show)
    this.$cwa.$eventBus.$on(EVENTS.addComponent, this.addComponent)
  },
  beforeDestroy() {
    window.removeEventListener('click', this.show)
    this.$cwa.$eventBus.$emit(EVENTS.showing, false)
    this.$cwa.$eventBus.$off(EVENTS.addComponent, this.addComponent)
  },
  methods: {
    getStatusTab(
      statusTabContext: StatusTabContext
    ): ComponentManagerTab | null {
      if (!statusTabContext.enabled) {
        return null
      }
      return {
        label: 'Status',
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
      this.$cwa.$eventBus.$emit(EVENTS.selectComponent, iri)
    },
    hide() {
      this.$cwa.$eventBus.$emit(EVENTS.hide)
      this.expanded = false
    },
    show() {
      this.pendingComponents = []
      if (this.showingCriteria) {
        this.$cwa.$eventBus.$emit(EVENTS.show)
      }
      // the show event above should be listened to and add-component event emitted to populate components by now
      if (!this.pendingComponents.length) {
        this.expanded = false
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
          this.expanded = this.showingCriteria
        })
      })
    },
    addComponent({ data, resource }: ComponentManagerAddEvent) {
      this.pendingComponents.push({ data, resource })
    },
    updateNotificationsShowing(newValue) {
      this.warningNotificationsShowing = newValue
    },
    handleBreadcrumbClick({ componentIndex }) {
      this.components = this.components.slice(componentIndex)
    }
  }
}
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
