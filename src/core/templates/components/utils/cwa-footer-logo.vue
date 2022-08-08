<template>
  <div class="cwa-footer-logo">
    <div class="top">
      <slot />
    </div>
    <div class="cwa-footer">
      <div class="logo">
        <cwa-nuxt-link to="https://cwa.rocks" target="_blank" rel="noopener">
          <cwa-logo class="cwa-logo" />
          <span class="is-sr-only">Components Web App</span>
        </cwa-nuxt-link>
      </div>
    </div>
  </div>
</template>

<script>
import CwaNuxtLink from './cwa-nuxt-link'
import CwaLogo from './cwa-logo'
export default {
  components: { CwaLogo, CwaNuxtLink }
}
</script>

<style lang="sass">
.cwa-footer-logo
  display: flex
  flex-direction: column
  height: 100%
  > .top
    flex-grow: 1
    padding-top: 2.5rem
  .cwa-footer
    margin-top: 2rem
    text-align: center
    .cwa-logo
      width: auto
      height: 20px
      margin-bottom: 2rem
    a:not(:hover)
        opacity: .6
</style>
