<template>
  <div class="path-selector">
    <div class="row row-no-padding row-center">
      <div class="column">
        <resource-locations
          :name="components[0].data.name"
          :iri="components[0].iri"
        />
      </div>
      <div class="column is-narrow">
        <button
          ref="moreButton"
          type="button"
          class="button button-cwa is-more"
          @click="toggleAltOptions"
        >
          <img src="../../../../assets/images/more.svg" alt="more options" />
        </button>
      </div>
    </div>
    <ul v-show="showAltMenu" ref="componentList" class="component-list">
      <li
        v-for="(component, componentIndex) in componentOptions"
        :key="`path-breadcrumb-${component.iri}`"
      >
        <button
          class="button button-cwa"
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
  background: $control-background-color
  border-radius: 2rem
  padding: 0 0 0 1.5rem
  position: relative
  .button
    &.is-more
      border-left: 1px solid $control-background-hover-color
      padding: 2rem 1.5rem
      margin: 0 0 0 1.5rem
      border-radius: 0 2rem 2rem 0
  ul.component-list
    list-style: none
    position: absolute
    width: 100%
    top: 100%
    left: 0
    z-index: 2
    margin: 0
    > li
      margin-bottom: .25rem
      &:last-child
        margin-bottom: 0
      .button-cwa
        margin: 0
        width: 100%
        border-radius: 2rem
//.path-breadcrumbs
//  > ul
//    list-style: none
//    margin: 0
//    padding: 0
//    align-items: center
//    font-size: 1.3rem
//    white-space: nowrap
//    a
//      color: $cwa-color-text-light
//      &:hover,
//      .is-active
//        color: $white
</style>
