<template>
  <div class="cm-button">
    <div
      ref="buttonsRow"
      class="columns is-centered buttons-row is-gapless is-marginless"
    >
      <button
        ref="button"
        type="button"
        class="button cm-button-button"
        :disabled="disabled"
        @click="handleButtonClick"
      >
        <span><slot /></span>
      </button>
      <button
        v-if="altOptionsAvailable"
        ref="altButton"
        type="button"
        class="cm-button-button is-more"
        :disabled="disabled"
        @click="toggleAltOptions"
      >
        <img src="../../../../../assets/images/more.svg" alt="more options" />
      </button>
    </div>
    <ul v-show="showAltMenu" ref="altOptionsList" class="alt-options-list">
      <li v-for="(altOp, index) of altOptions" :key="`${index}-${altOp.key}`">
        <button
          type="button"
          class="cm-button-button"
          @click="optionClick(altOp)"
        >
          {{ altOp.label }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import type { PropType } from 'vue'
import { createPopper } from '@popperjs/core'

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
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      showAltMenu: false,
      popperInstance: null
    }
  },
  computed: {
    altOptionsAvailable() {
      return this.altOptions && this.altOptions.length
    }
  },
  watch: {
    showAltMenu: {
      handler(newValue) {
        if (!this.popperInstance) {
          return
        }

        if (newValue) {
          this.popperInstance.setOptions((options) => ({
            ...options,
            modifiers: [
              ...options.modifiers,
              { name: 'eventListeners', enabled: true }
            ]
          }))
          this.popperInstance.update()
        } else {
          this.popperInstance.setOptions((options) => ({
            ...options,
            modifiers: [
              ...options.modifiers,
              { name: 'eventListeners', enabled: false }
            ]
          }))
        }
      },
      immediate: true
    }
  },
  mounted() {
    this.popperInstance = createPopper(
      this.$refs.buttonsRow,
      this.$refs.altOptionsList,
      {
        placement: 'bottom',
        modifiers: [
          {
            name: 'offset',
            options: {
              offset: [0, 5]
            }
          },
          {
            name: 'preventOverflow',
            options: {
              padding: 8
            }
          }
        ]
      }
    )
  },
  methods: {
    optionClick(altOp) {
      this.$emit('click', altOp.key)
      this.hideAltOptions()
    },
    toggleAltOptions() {
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
        this.$refs.altButton.blur()
      }, 1)
    },
    handleButtonClick() {
      this.$refs.button.blur()
      this.$emit('click', null)
    }
  }
})
</script>

<style lang="sass">
.cm-button
  position: relative
  .buttons-row
    box-shadow: $cwa-control-shadow
  .cm-button-button
    +cwa-button
    margin-bottom: 0
    z-index: 1
    box-shadow: none
    &.is-more
      border-left: 1px solid $cwa-control-background-hover-color
      padding-left: 1.5rem
      padding-right: 1.5rem
  .alt-options-list
    width: 100%
    margin: 0
    list-style: none
    z-index: 2
    li
      margin-bottom: .5rem
      &:last-child
        margin-bottom: 0
      button
        width: 100%
  &.is-primary
    .cm-button-button
      background-color: $cwa-color-primary
      color: $white
      &:hover,
      &:focus
        background-color: darken($cwa-color-primary, 3%)
</style>
