<template>
  <client-only>
    <div v-if="$cwa.isAdmin" class="cwa-admin-bar">
      <div class="left">
        <div class="status-icon"></div>
        <a class="errors" href="#">
          <div class="triangle"></div>
          <span class="total">1</span>
        </a>
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
export default {
  components: {CwaNuxtLink, CwaAdminBarMenu}
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
    .status-icon
      width: 20px
      height: 20px
      border-radius: 50%
      background: $cwa-success
      background-clip: content-box
      border: 3px solid transparent
      box-shadow: 0 0 0 1px $cwa-success
    .errors
      position: relative
      width: .95em
      height: .95em
      margin: 0 1.8rem
      .total
        position: absolute
        z-index: 2
        color: white
        top: 50%
        left: 50%
        transform: translate(-50%, -35%)
        font-size: .8em
        font-weight: $font-weight-bold
      .triangle
        z-index: 1
        position: relative
        background-color: $cwa-danger
        transform: rotate(-60deg) skewX(-30deg) scale(1,.866)
        &:before,
        &:after
          content: ''
          position: absolute
          background-color: inherit
        &:before
          transform: rotate(-135deg) skewX(-45deg) scale(1.414,.707) translate(0,-50%)
        &:after
          transform: rotate(135deg) skewY(-45deg) scale(.707,1.414) translate(50%,0)
      .triangle,
      .triangle:before,
      .triangle:after
        width: 100%
        height: 100%
        border-top-right-radius: 30%
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
