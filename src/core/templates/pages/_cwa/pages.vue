<template>
  <cwa-footer-logo class="cwa-layouts-page">
    <div class="container">
      <cwa-grid-header title="Pages" />
      <div class="row row-wrap grid">
        <div class="column">
          <div class="grid-loading">
            <cwa-loader />
          </div>
        </div>
      </div>
      <div class="row pagination-bar">
        <div class="column page-numbers">
          <a>1</a>
          <a>2</a>
          <a>3</a>
          <a>4</a>
        </div>
        <div class="column is-narrow">
          <div class="row">
            <div class="column">
              <a><img src="../../../assets/images/arrow-left.svg" alt="Left Arrow - Previous Page" /></a>
            </div>
            <div class="column">
              <a><img src="../../../assets/images/arrow-right.svg" alt="Right Arrow - Next Page" /></a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </cwa-footer-logo>
</template>

<script>
import commonMixin from './commonMixin'
import CwaFooterLogo from '../../components/cwa-footer-logo'
import CwaGridHeader from '../../components/cwa-grid-header'
import NuxtErrorIcon from '../../components/nuxt-error-icon'
import CwaLoader from "../../cwa-loader.vue";

export default {
  components: {CwaLoader, NuxtErrorIcon, CwaGridHeader, CwaFooterLogo},
  mixins: [commonMixin]
}
</script>

<style lang="sass">
.cwa-header
  align-items: center
  h1
    margin: 0 2rem 0 0
.cwa-filter-bar
  margin-top: 2rem
  input[type=text],
  select
    border-color: $cwa-navbar-background
    background-color: $cwa-navbar-background
    color: $cwa-color-text-light
    padding: .2rem 3.8rem .3rem 1.0rem
    height: 3.4rem
    font-size: 1.4rem
    &:hover
      color: $white
    &::placeholder
      color: rgba($cwa-color-text-light, .6)
  .select
    position: relative
    &:hover
      &::before
        opacity: 1
    select
      background-image: none
      margin: 0
    &::before
      content: ''
      position: absolute
      right: 0
      top: 0
      height: 100%
      width: 3.5rem
      background: url("../../../assets/images/icon-dropdown.svg") 50% 50% no-repeat
      opacity: .6
      pointer-events: none
  input[type=text]
    width: 100%
    min-width: 300px
    max-width: 600px
    &:focus
      color: $white

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

.pagination-bar
  margin-top: 2rem
  color: $white
  a
    opacity: 0.6
    &:hover,
    &.selected
      opacity: 1
      color: $white
  .page-numbers
    a
      padding: 0 1rem
</style>
