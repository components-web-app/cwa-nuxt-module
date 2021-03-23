<template>
  <div v-if="$cwa.resourcesOutdated" class="container cwa-refresh-bar">
    <div class="inner">
      <span>The content on this page is outdated.</span>
      <button class="button-outline" @click="$cwa.mergeNewResources()">
        Update page
      </button>
    </div>
  </div>
</template>

<script>
export default {}
</script>

<style lang="sass">
.cwa-refresh-bar
  z-index: 10
  position: relative
  display: flex
  justify-content: center
  font-size: 1.4rem
  > .inner
    display: flex
    justify-content: center
    align-items: center
    width: auto
    background: $cwa-navbar-background
    color: $cwa-color-text-light
    padding: .75rem 1.5rem
    border-radius: 0 0 10px 10px
  button
    margin: 0 0 0 1rem
    font-size: 1.2rem
    padding-left: 1rem
    padding-right: 1rem
    color: currentColor
    border-color: currentColor
</style>
