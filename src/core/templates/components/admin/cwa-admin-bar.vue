<template>
  <client-only v-if="$cwa.isAdmin">
    <div @click.stop>
      <div
        class="cwa-admin-bar is-placeholder"
        :style="{ height: `${elementHeight}` }"
      />
      <transition-expand>
        <div v-show="isShowing" ref="cwaAdminBar" class="cwa-admin-bar">
          <div class="inner">
            <div class="left">
              <div class="icons">
                <a href="#" @click.prevent="showPageEditModal">
                  <img
                    src="../../../assets/images/icon-info.svg"
                    alt="Builder Icon"
                  />
                </a>
              </div>
              <div v-if="currentView === 'page'" class="controls">
                <cwa-admin-toggle
                  id="edit-mode"
                  v-model="editMode"
                  label="Edit mode"
                />
              </div>
            </div>
            <div class="center">
              <div class="icons">
                <cwa-nuxt-link :to="builderLink" exact :class="builderClass">
                  <img
                    src="../../../assets/images/icon-builder.svg"
                    alt="Builder Icon"
                  />
                </cwa-nuxt-link>
                <cwa-nuxt-link to="/_cwa/layouts">
                  <img
                    src="../../../assets/images/icon-layout.svg"
                    alt="Layouts Icon"
                  />
                </cwa-nuxt-link>
                <cwa-nuxt-link to="/_cwa/pages">
                  <img
                    src="../../../assets/images/icon-pages.svg"
                    alt="Pages Icon"
                  />
                </cwa-nuxt-link>
                <cwa-nuxt-link to="/_cwa/components">
                  <img
                    src="../../../assets/images/icon-components.svg"
                    alt="Components Icon"
                  />
                </cwa-nuxt-link>
                <cwa-nuxt-link to="/_cwa/users">
                  <img
                    src="../../../assets/images/icon-users.svg"
                    alt="Users Icon"
                  />
                </cwa-nuxt-link>
              </div>
            </div>
            <div class="right">
              <cwa-admin-bar-menu :force-hide="!isShowing" />
            </div>
          </div>
        </div>
      </transition-expand>
      <cwa-admin-bar-page-info-modal
        v-if="pageInfoShowing && isShowing"
        @close="pageInfoShowing = false"
      />
    </div>
  </client-only>
</template>

<script lang="ts">
import Vue from 'vue'
import HeightMatcherMixin from '@cwa/nuxt-module/core/mixins/HeightMatcherMixin'
import {
  COMPONENT_MANAGER_EVENTS,
  ADMIN_BAR_EVENTS
} from '@cwa/nuxt-module/core/events'
import CwaNuxtLink from '../utils/cwa-nuxt-link.vue'
import TransitionExpand from '../utils/transition-expand.vue'
import CwaAdminBarMenu from './cwa-admin-bar-menu.vue'
import CwaAdminToggle from './input/cwa-admin-toggle.vue'
import CwaAdminBarPageInfoModal from './cwa-admin-bar-page-info-modal.vue'

export default Vue.extend({
  components: {
    CwaAdminBarPageInfoModal,
    CwaAdminToggle,
    CwaNuxtLink,
    CwaAdminBarMenu,
    TransitionExpand
  },
  mixins: [HeightMatcherMixin('cwaAdminBar')],
  data() {
    return {
      currentView: 'page',
      managerShowing: false,
      pageInfoShowing: false
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
    isShowing() {
      return !this.managerShowing
    }
  },
  mounted() {
    this.$cwa.$eventBus.$on(ADMIN_BAR_EVENTS.changeView, this.changeView)
    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.showing,
      this.componentManagerShowingListener
    )
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off(ADMIN_BAR_EVENTS.changeView, this.changeView)
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.showing,
      this.componentManagerShowingListener
    )
  },
  methods: {
    changeView(viewName) {
      this.currentView = viewName
    },
    componentManagerShowingListener(isShowing) {
      this.managerShowing = isShowing
    },
    showPageEditModal() {
      this.pageInfoShowing = !this.pageInfoShowing
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
    color: $cwa-color-text-light
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
      +mobile
        display: none
      .icons
        display: flex
        width: 100%
        max-width: 340px
        justify-content: space-between
        align-items: center
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
