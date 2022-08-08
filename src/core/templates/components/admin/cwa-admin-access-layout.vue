<template>
  <div class="container login-page">
    <div>
      <div class="logo">
        <cwa-logo />
        <h1>{{ title }}</h1>
      </div>
      <slot />
    </div>
  </div>
</template>

<script>
import CwaLogo from '../utils/cwa-logo.vue'
export default {
  components: { CwaLogo },
  props: {
    title: {
      type: String,
      required: true
    }
  }
}
</script>
<style lang="sass">
.login-page
  padding: 2rem
  min-height: 100vh
  display: flex
  align-items: center
  > div
    width: 100%
    max-width: 500px
  .logo
    margin-bottom: 1.5rem
    h1
      +font-lemonmilk
      font-size: 1.5rem
      margin-top: .5rem
    svg
      max-width: 300px
      height: auto
    +mobile
      svg
        max-width: 180px
</style>
