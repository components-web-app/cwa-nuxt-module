<template>
  <div :class="['path-selector', { 'no-options': !componentOptions.length }]">
    <div class="columns is-centered is-vcentered is-marginless">
      <div class="column resource-column">
        <resource-locations
          :name="components[0].data.name"
          :iri="components[0].iri"
        />
      </div>
      <div
        v-if="componentOptions.length"
        class="column is-narrow more-button-column"
      >
        <button
          ref="moreButton"
          type="button"
          class="button is-cwa is-more"
          @click="toggleAltOptions"
        >
          <img src="../../../../assets/images/more.svg" alt="more options" />
        </button>
      </div>
    </div>
    <ul v-show="showAltMenu" ref="componentList" class="component-list">
      <li
        v-for="(component, componentIndex) in componentOptions"
        :key="`path-select-${component.iri}-${componentIndex}`"
      >
        <button
          class="button is-cwa"
          @click="$emit('click', { componentIndex: componentIndex + 1 })"
        >
          <resource-locations
            :name="component.data.name"
            :iri="component.iri"
          />
        </button>
      </li>
    </ul>
  </div>
</template>

<script>
import { createPopper } from '@popperjs/core'
import ResourceLocations from '@cwa/nuxt-module/core/templates/components/admin/cwa-component-manager/resource-locations.vue'

export default {
  components: { ResourceLocations },
  props: {
    components: {
      type: Array,
      required: true
    }
  },
  data() {
    return {
      showAltMenu: false,
      popperInstance: null
    }
  },
  computed: {
    componentOptions() {
      return this.components.slice(1)
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
    this.popperInstance = createPopper(this.$el, this.$refs.componentList, {
      placement: 'bottom',
      modifiers: [
        {
          name: 'offset',
          options: {
            offset: [0, 7]
          }
        },
        {
          name: 'preventOverflow',
          options: {
            padding: 8
          }
        }
      ]
    })
  },
  methods: {
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
        this.$refs.componentList.blur()
      }, 1)
    }
  }
}
</script>

<style lang="sass">
.path-selector
  color: $white
  background: $cwa-control-background-color
  border-radius: 1.2rem
  padding: 0
  position: relative
  > .columns
    padding: 0
    margin: 0
    width: 100%
  .column
    padding: 0
  .resource-column
    padding: .7rem .25rem .7rem 1rem
  &.no-options
    .resource-column
      padding-right: 1.5rem
  .more-button-column
    position: relative
    padding: 0
    align-self: stretch
  .button
    &.is-more
      position: relative
      border-left: 1px solid $cwa-control-background-hover-color
      padding: 0 .75rem
      margin: 0 0 0 .75rem
      border-radius: 0 1.4rem 1.4rem 0
      height: 100%
      img
        display: block
  ul.component-list
    list-style: none
    position: absolute
    min-width: 100%
    top: 100%
    left: 0
    z-index: 2
    margin: 0
    > li
      margin-bottom: .25rem
      &:last-child
        margin-bottom: 0
      .button.is-cwa
        margin: 0
        width: 100%
        border-radius: 2rem
</style>
