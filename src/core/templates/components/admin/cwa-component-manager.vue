<template>
  <client-only v-if="$cwa.isAdmin">
    <div class="cwa-component-manager-holder" @click.stop>
      <div
        class="cwa-components-manager is-placeholder"
        :style="{ height: `${elementHeight}` }"
      />
      <transition-expand>
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
                <div class="column is-narrow">
                  <publishable-icon />
                </div>
                <div class="column is-narrow">
                  <status-icon :status="savedStatus" />
                </div>
                <div
                  v-if="warningNotificationsShowing"
                  class="column is-narrow"
                >
                  <error-notifications
                    :listen-categories="['components-manager']"
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
import { ComponentManagerAddEvent } from '@cwa/nuxt-module/core/mixins/ComponentManagerMixin'
import consola from 'consola'
import TransitionExpand from '../utils/transition-expand.vue'
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
      highlightOverlayElement: null
    } as {
      expanded: boolean
      components: Array<ComponentManagerAddEvent>
      pendingComponents: Array<ComponentManagerAddEvent>
      savedStatus: Number
      warningNotificationsShowing: boolean
      showHighlightOverlay: boolean
      highlightOverlayDom: Element
    }
  },
  computed: {
    showingCriteria() {
      return this.$cwa.isEditMode
    },
    isShowing() {
      return this.showingCriteria && this.expanded && this.components.length
    },
    selectedComponent() {
      return this.components?.[0] || null
    },
    componentData() {
      return this.selectedComponent?.data
    },
    componentTabs() {
      return this.componentData?.tabs
    },
    componentResource() {
      return this.selectedComponent?.resource
    }
  },
  watch: {
    isShowing(newValue) {
      this.$cwa.$eventBus.$emit('cwa:component-manager:showing', newValue)
      if (!newValue) {
        this.toggleComponent(null)
        if (this.expanded) {
          this.expanded = false
        }
      }
    },
    selectedComponent({ resource }) {
      this.toggleComponent(resource?.['@id'] || null)
    }
  },
  mounted() {
    window.addEventListener('click', this.show)
    this.$cwa.$eventBus.$on(
      'cwa:component-manager:add-component',
      this.addComponent
    )
  },
  beforeDestroy() {
    window.removeEventListener('click', this.show)
    this.$cwa.$eventBus.$emit('cwa:component-manager:showing', false)
    this.$cwa.$eventBus.$off(
      'cwa:component-manager:add-component',
      this.addComponent
    )
  },
  methods: {
    toggleComponent(iri?: string) {
      this.$cwa.$eventBus.$emit('cwa:component-manager:component', iri)
    },
    hide() {
      this.$cwa.$eventBus.$emit('cwa:component-manager:hide')
      this.expanded = false
    },
    show() {
      this.pendingComponents = []
      if (this.showingCriteria) {
        this.$cwa.$eventBus.$emit('cwa:component-manager:show')
      }
      // the show event above should be listened to and add-component event emitted to populate components by now
      if (!this.pendingComponents.length) {
        this.expanded = false
        consola.info('Not showing components manager. No menu data populated.')
        return
      }
      this.components = this.pendingComponents
      this.$nextTick(() => {
        this.expanded = this.showingCriteria
        this.$cwa.$eventBus.$emit(
          'cwa:component-manager:showing',
          this.showingCriteria
        )
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
@keyframes border-rotate
  to
    --angle: 360deg

@property --angle
  syntax: '<angle>'
  initial-value: 0deg
  inherits: false

.cwa-manager-highlighted
  --angle: 0deg
  border: 4px solid
  border-image: conic-gradient(from var(--angle), $cwa-color-primary, $color-warning, $cwa-color-primary) 1
  animation: 3s border-rotate ease-in-out infinite

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
  > .inner
    > .bottom
      padding: 1rem
      background: $cwa-background-dark
      display: flex
      align-items: center
  .done-link
    position: absolute
    top: 0
    right: 0
    padding: 1rem
    color: inherit
</style>
