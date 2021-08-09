<template>
  <div class="cm-button">
    <button class="cm-button-button" @click="$emit('click', null)">
      <span><slot /></span>
      <a
        v-if="altOptionsAvailable"
        class="alt-toggle-arrow"
        @click.stop="showAltOptions"
      >
        <img
          src="../../../../../assets/images/arrow-left.svg"
          alt="toggle arrow"
        />
      </a>
    </button>
    <ul v-if="showAltMenu" class="alt-options-list">
      <li v-for="(altOp, index) of altOptions" :key="`${index}-${altOp.key}`">
        <a @click.stop="optionClick(altOp)">{{ altOp.label }}</a>
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import type { PropType } from 'vue'

export interface altOption {
  label: string
  key: string
}

export default Vue.extend({
  props: {
    altOptions: {
      required: false,
      type: Array as PropType<altOption[]>,
      default: null
    }
  },
  data() {
    return {
      showAltMenu: false
    }
  },
  computed: {
    altOptionsAvailable() {
      return this.altOptions && this.altOptions.length
    }
  },
  methods: {
    optionClick(altOp) {
      this.$emit('click', altOp.key)
      this.hideAltOptions()
    },
    showAltOptions() {
      if (this.showAltMenu) {
        this.hideAltOptions()
        return
      }
      this.showAltMenu = true
      document.body.addEventListener('click', this.hideAltOptions, true)
    },
    hideAltOptions() {
      setTimeout(() => {
        if (!this.showAltMenu) {
          return
        }
        this.showAltMenu = false
        document.body.removeEventListener('click', this.hideAltOptions, true)
      }, 1)
    }
  }
})
</script>

<style lang="sass">
.cm-button
  position: relative
  .cm-button-button
    +cwa-control
    border: 1px solid $cwa-color-text-light
    font-weight: $font-weight-normal
    line-height: normal
    margin-bottom: 0
    z-index: 1
    &:hover
      color: $white
  .alt-toggle-arrow
    position: relative
    width: 3em
    height: calc(100% + 1rem)
    padding-right: .5rem
    margin: -.5rem -3rem -.5rem 3rem
    &::before
      content: ''
      position: absolute
      top: .5rem
      left: 0px
      bottom: .5rem
      border-left: 1px solid $cwa-color-text-light
    img
      transform: translate(-50%, -50%) rotate(90deg)
      position: absolute
      top: 50%
      left: 50%
      max-width: 80%
      height: auto
  .alt-options-list
    position: absolute
    bottom: 100%
    right: 0
    border: 1px solid $cwa-color-text-light
    background-color: $control-background-color
    padding: .75rem
    margin: 0
    transform: translateY(-2px)
    list-style: none
    z-index: 2
    li
      margin-bottom: .5rem
      &:last-child
        margin-bottom: 0
      a
        cursor: pointer
</style>
