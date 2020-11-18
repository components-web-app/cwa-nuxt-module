<template>
  <client-only v-if="$cwa.isAdmin">
    <div class="cwa-admin-bar">
      <template v-if="currentView === 'page'">
        <div class="left">
          <div class="status">
            <status-icon :status="-2" />
            <error-notifications />
          </div>
          <div class="controls">
            <cwa-admin-toggle id="edit-mode" label="Edit mode" v-model="editMode" />
          </div>
        </div>
      </template>
      <template v-if="currentView === 'admin'">
        <div class="center">
          <div class="icons">
            <cwa-nuxt-link to="/_cwa/layouts">
              <img src="../../assets/images/icon-layout.svg" alt="Layouts Icon" />
            </cwa-nuxt-link>
            <cwa-nuxt-link to="/_cwa/pages">
              <img src="../../assets/images/icon-pages.svg" alt="Pages Icon" />
            </cwa-nuxt-link>
            <cwa-nuxt-link>
              <img src="../../assets/images/icon-components.svg" alt="Components Icon" />
            </cwa-nuxt-link>
            <cwa-nuxt-link>
              <img src="../../assets/images/icon-users.svg" alt="Users Icon" />
            </cwa-nuxt-link>
          </div>
        </div>
      </template>
      <div class="right">
        <cwa-admin-bar-menu />
      </div>
    </div>
  </client-only>
</template>

<script>
import CwaAdminBarMenu from "./cwa-admin-bar-menu"
import CwaNuxtLink from "./cwa-nuxt-link";
import StatusIcon from './admin/status-icon'
import ErrorNotifications from './admin/error-notifications'
import CwaAdminToggle from './admin/input/cwa-admin-toggle'
export default {
  components: {CwaAdminToggle, ErrorNotifications, StatusIcon, CwaNuxtLink, CwaAdminBarMenu},
  data() {
    return {
      currentView: 'admin'
    }
  },
  mounted() {
    this.$cwa.$eventBus.$on('cwa:admin-bar:change-view', this.changeView)
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off('cwa:admin-bar:change-view', this.changeView)
  },
  computed: {
    editMode: {
      set(value) {
        this.$cwa.setEditMode(value)
      },
      get() {
        return this.$cwa.isEditMode()
      }
    }
  },
  methods: {
    changeView(viewName) {
      this.currentView = viewName
    }
  }
}
</script>

<style lang="sass">
.cwa-admin-bar
  font-family: $cwa-font-family
  padding: 2rem
  background: $cwa-navbar-background
  color: $cwa-color-text-light
  display: flex
  justify-content: space-between
  align-items: center
  border-bottom: 2px solid #414040
  z-index: 1000
  > div
    display: flex
  .left
    align-items: center
    .controls
      margin-left: 1em
      label
        margin-left: .7em
        font-size: .85em
  .center
    flex-grow: 1
    justify-content: center
    +mobile
      display: none
    .icons
      display: flex
      width: 100%
      max-width: 340px
      justify-content: space-between
      align-items: center
      > a
        transition: opacity .25s
        display: block
        margin: 0 1rem
        opacity: .6
        &:hover
          opacity: .8
        &.nuxt-link-active
          opacity: 1
</style>
