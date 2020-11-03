<template>
  <client-only>
    <div v-if="$cwa.isAdmin" class="cwa-admin-bar">
      <div class="left">
        <status-icon />
        <error-notifications />
      </div>
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
export default {
  components: {ErrorNotifications, StatusIcon, CwaNuxtLink, CwaAdminBarMenu}
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
