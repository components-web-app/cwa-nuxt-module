<template>
  <div class="row row-wrap grid">
    <div class="column">
      <div class="grid-loading">
        <cwa-loader />
      </div>
    </div>
    <div class="column no-items-found">
      <div class="not-found-icon">
        <nuxt-error-icon />
      </div>
      Sorry, no items found
    </div>
  </div>
</template>

<script>
import CwaLoader from '../cwa-loader'
import NuxtErrorIcon from './nuxt-error-icon'
export default {
  components: {NuxtErrorIcon, CwaLoader}
}
</script>

<style lang="sass">
@keyframes rotate-180
  20%
    transform: rotate(0deg) scale(.9)
    opacity: 1
  100%
    transform: rotate(180deg)
    opacity: 1

@keyframes no-items-fade-in
  100%
    opacity: .5

.grid
  .no-items-found
    text-align: center
    opacity: 0
    padding: 3rem 0
    animation: no-items-fade-in 1s
    animation-delay: .2s
    animation-fill-mode: forwards
    .not-found-icon > svg
      animation: rotate-180 2s
      animation-delay: 1.2s
      animation-fill-mode: forwards
      transform-origin: 50% 50%
      opacity: 0
</style>
