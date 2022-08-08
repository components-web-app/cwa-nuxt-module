<template>
  <div class="grid-loader">
    <div v-if="isLoading">
      <div class="grid-loading">
        <cwa-loader />
      </div>
    </div>
    <div v-else-if="!totalItems" class="no-items-found">
      <div class="not-found-icon">
        <nuxt-error-icon />
      </div>
      Sorry, no items found
    </div>
    <ul v-else class="columns is-multiline grid">
      <slot />
    </ul>
  </div>
</template>

<script>
import CwaLoader from '../utils/cwa-loader'
import NuxtErrorIcon from '../utils/nuxt-error-icon'
export default {
  components: { NuxtErrorIcon, CwaLoader },
  props: {
    isLoading: {
      type: Boolean,
      required: true
    },
    totalItems: {
      type: Number,
      required: false,
      default: null
    }
  }
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

.grid-loader
  .no-items-found
    text-align: center
    opacity: 0
    padding: 3rem 0
    animation: no-items-fade-in 1s
    animation-fill-mode: forwards
    .not-found-icon > svg
      animation: rotate-180 2s
      animation-delay: .6s
      animation-fill-mode: forwards
      transform-origin: 50% 50%
      opacity: 0
  .grid
    margin-top: 1.25rem
</style>
