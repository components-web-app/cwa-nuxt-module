<template>
  <client-only v-if="$cwa.isAdmin">
    <div @click.stop>
      <div
        class="cwa-admin-bar is-placeholder"
        :style="{ height: `${elementHeight}` }"
      />
      <div ref="cwaAdminBar" class="cwa-admin-bar">
        <div class="inner">
          <div class="left">
            <template v-if="currentView === 'page'">
              <div class="icons">
                <a href="#" @click.prevent="showPageEditModal">
                  <img
                    src="../../../assets/images/cog.svg"
                    alt="Page Settings Cog Icon"
                  />
                </a>
              </div>
              <div class="controls">
                <cm-button
                  id="cwa-cm-edit-button"
                  @click="editMode = !editMode"
                  >{{ editMode ? 'Done' : 'Edit Page' }}</cm-button
                >
              </div>
            </template>
          </div>
          <div class="center">
            <div v-if="!editMode" class="center-highlight icons">
              <cwa-nuxt-link
                :to="builderLink"
                exact
                :class="builderClass"
                :always-clickable="true"
              >
                <img src="../../../assets/images/view.svg" alt="View Icon" />
              </cwa-nuxt-link>
              <cwa-nuxt-link to="/_cwa/layouts" :always-clickable="true">
                <img
                  src="../../../assets/images/icon-layout.svg"
                  alt="Layouts Icon"
                />
              </cwa-nuxt-link>
              <cwa-nuxt-link to="/_cwa/pages" :always-clickable="true">
                <img
                  src="../../../assets/images/icon-pages.svg"
                  alt="Pages Icon"
                />
              </cwa-nuxt-link>
              <!--
                We will have a page to view/visualise website components and where they are used. After Alpha.1
                <cwa-nuxt-link to="/_cwa/components">
                  <img
                    src="../../../assets/images/icon-components.svg"
                    alt="Components Icon"
                  />
                </cwa-nuxt-link>
                -->
              <cwa-nuxt-link to="/_cwa/users" :always-clickable="true">
                <img
                  src="../../../assets/images/icon-users.svg"
                  alt="Users Icon"
                />
              </cwa-nuxt-link>
            </div>
            <div v-else class="center-highlight">
              <div
                v-if="!isComponentSelected"
                :class="['header-prompt', { 'is-showing': showHeaderPrompt }]"
              >
                Now select a component...
              </div>
              <div v-else-if="components" class="selected-component-title">
                <path-breadcrumbs
                  :components="components"
                  @click="handleBreadcrumbClick"
                />
              </div>
            </div>
          </div>
          <div class="right">
            <cwa-admin-bar-menu
              v-if="!editMode"
              :force-hide="isComponentSelected"
            />
            <div v-else-if="isComponentSelected" class="row row-center">
              <div class="column is-narrow status-container">
                <status-icon
                  :status="isNew ? 0 : 1"
                  :show-above="false"
                  category="components-manager"
                  @errors-showing="updateNotificationsShowing"
                />
              </div>
              <div v-if="showStatusTab" class="column is-narrow">
                <publishable-icon
                  :is-draft="isDraft"
                  :is-scheduled="isScheduled"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <cwa-admin-bar-page-info-modal
        v-if="pageInfoShowing"
        @close="pageInfoShowing = false"
      />
    </div>
  </client-only>
</template>

<script lang="ts">
import Vue from 'vue'
import CwaNuxtLink from '../utils/cwa-nuxt-link.vue'
import HeightMatcherMixin from '../../../mixins/HeightMatcherMixin'
import CwaAdminBarMenu from './cwa-admin-bar-menu.vue'
import CwaAdminBarPageInfoModal from './cwa-admin-bar-page-info-modal.vue'
import CmButton from './cwa-component-manager/input/cm-button.vue'
import StatusIcon from './status-icon.vue'
import PublishableIcon from './cwa-component-manager/publishable-icon.vue'
import PathBreadcrumbs from './cwa-component-manager/path-breadcrumbs.vue'
import {
  COMPONENT_MANAGER_EVENTS,
  ADMIN_BAR_EVENTS,
  ComponentManagerAddEvent
} from '@cwa/nuxt-module/core/events'

export default Vue.extend({
  components: {
    PathBreadcrumbs,
    PublishableIcon,
    StatusIcon,
    CmButton,
    CwaAdminBarPageInfoModal,
    CwaNuxtLink,
    CwaAdminBarMenu
  },
  mixins: [HeightMatcherMixin('cwaAdminBar')],
  data() {
    return {
      currentView: 'page',
      managerShowing: false,
      pageInfoShowing: false,
      warningNotificationsShowing: false,
      componentIri: null,
      components: [],
      showHeaderPrompt: false
    }
  },
  computed: {
    editMode: {
      set(value) {
        this.$cwa.setEditMode(value)
      },
      get() {
        return this.$cwa.isEditMode
      }
    },
    builderLink() {
      return this.currentView === 'admin' ? '/' : this.$route.path
    },
    builderClass() {
      return this.currentView !== 'admin'
        ? 'nuxt-link-exact-active nuxt-link-active'
        : ''
    },
    isComponentSelected() {
      return !!this.managerShowing
    },
    isNew() {
      return this.componentIri && this.componentIri.endsWith('/new')
    },
    selectedComponent(): ComponentManagerAddEvent | null {
      return this.components?.[0] || null
    },
    componentData() {
      return this.selectedComponent?.data
    },
    showStatusTab() {
      return !!this.componentData?.context?.statusTab?.enabled
    },
    isDraft() {
      if (!this.showStatusTab) {
        return false
      }
      if (!this.componentIri) {
        return false
      }
      const storageResource = this.$cwa.getResource(this.componentIri)
      return storageResource?._metadata?.published === false || false
    },
    isScheduled() {
      if (!this.isDraft) {
        return false
      }
      const storageResource = this.$cwa.getResource(this.componentIri)
      return !!storageResource && !!storageResource._metadata?.publishedAt
    },
    headerPromptVisibilityChange() {
      return this.editMode && !this.isComponentSelected
    }
  },
  watch: {
    headerPromptVisibilityChange(newValue) {
      window.requestAnimationFrame(() => {
        this.showHeaderPrompt = newValue
      })
    }
  },
  mounted() {
    this.$cwa.$eventBus.$on(ADMIN_BAR_EVENTS.changeView, this.changeView)
    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.showing,
      this.componentManagerShowingListener
    )
    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.componentsInitialised,
      this.updateComponents
    )
    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.selectedComponentIri,
      this.updateSelectedComponentIri
    )
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off(ADMIN_BAR_EVENTS.changeView, this.changeView)
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.showing,
      this.componentManagerShowingListener
    )
    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.componentsInitialised,
      this.updateComponents
    )
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.selectedComponentIri,
      this.updateSelectedComponentIri
    )
  },
  methods: {
    handleBreadcrumbClick({ componentIndex }) {
      const selectedComponent = this.components[componentIndex]
      this.$cwa.$eventBus.$emit(
        COMPONENT_MANAGER_EVENTS.selectComponent,
        selectedComponent.iri
      )
      this.$cwa.$eventBus.$emit(
        COMPONENT_MANAGER_EVENTS.selectPosition,
        selectedComponent.componentPositions?.[0] || null
      )
    },
    updateComponents(components) {
      this.components = components
    },
    updateSelectedComponentIri(componentIri) {
      this.componentIri = componentIri
    },
    changeView(viewName) {
      this.currentView = viewName
    },
    componentManagerShowingListener(isComponentSelected) {
      this.managerShowing = !!isComponentSelected
    },
    showPageEditModal() {
      this.pageInfoShowing = !this.pageInfoShowing
    },
    updateNotificationsShowing(newValue) {
      this.warningNotificationsShowing = newValue
    }
  }
})
</script>

<style lang="sass">
.cwa-admin-bar
  position: relative
  font-family: $cwa-font-family
  z-index: 100
  &:not(.is-placeholder)
    position: fixed
    top: 0
    left: 0
    width: 100%
  > .inner
    padding: 2rem
    background: $cwa-navbar-background
    display: flex
    justify-content: space-between
    border-bottom: 2px solid #414040
    align-items: center
    > div
      display: flex
    .left
      align-items: center
      .icons > a:first-child
        margin-left: 0
      .controls label
        font-size: .85em
    .center
      position: absolute
      justify-content: center
      top: 0
      left: 50%
      transform: translateX(-50%)
      height: 100%
      .header-prompt
        transition: all .3s
        transform: translateY(-10px)
        padding: 1rem 1.5rem
        border-radius: 2rem
        opacity: 0
        &.is-showing
          background: $control-background-color
          color: $white
          transform: translateY(0)
          opacity: 1
      //+mobile
      //  display: none
      .center-highlight
        display: flex
        width: 100%
        // max-width: 340px
        justify-content: space-between
        align-items: center
        &.icons
          color: $cwa-color-text-light
      .selected-component-title
        width: auto
        min-width: 150px
        max-width: 50vw
        overflow: visible
    .icons
      > a
        transition: opacity .25s
        opacity: .6
        display: block
        margin: 0 1.5rem
        &:hover
          opacity: .8
        &.nuxt-link-active
          opacity: 1
        > img
          display: block
</style>
