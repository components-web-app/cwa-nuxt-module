<template>
  <div class="cwa-manager-tabs">
    <ul class="row">
      <li
        v-for="(tab, index) of orderedTabs"
        :key="loopKey('tab', index)"
        :class="[
          'column',
          'is-narrow',
          'cwa-manager-tab',
          { 'is-selected': index === selectedTabIndex }
        ]"
      >
        <a href="#" @click.prevent="showTab(index)">{{ tab.label }}</a>
      </li>
    </ul>
    <div class="tab-content-container">
      <div class="tab-content">
        <component
          :is="tab.component"
          v-for="(tab, index) of orderedTabs"
          v-show="index === selectedTabIndex"
          :key="loopKey('tab-content', index)"
          :resource="resource"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { ComponentManagerTab } from '@cwa/nuxt-module/core/mixins/ComponentManagerMixin.ts'
import { COMPONENT_MANAGER_EVENTS } from '../../../../events'

export default {
  props: {
    tabs: {
      type: Array,
      required: true
    },
    resource: {
      type: Object,
      required: false,
      default: null
    }
  },
  data() {
    return {
      selectedTabIndex: 0
    }
  },
  computed: {
    orderedTabs() {
      return [...this.tabs].sort(
        (itemA: ComponentManagerTab, itemB: ComponentManagerTab) => {
          const priorityA = itemA.priority || 0
          const priorityB = itemB.priority || 0
          return priorityA - priorityB
        }
      )
    },
    resourceId() {
      return this?.resource['@id'] || 'new'
    },
    loopKey() {
      return (label, index) => {
        return `${this.resourceId}-${label}-${index}`
      }
    }
  },
  mounted() {
    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.component,
      this.resetTabSelector
    )
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.component,
      this.resetTabSelector
    )
  },
  methods: {
    showTab(newIndex) {
      this.selectedTabIndex = newIndex
    },
    resetTabSelector() {
      this.showTab(0)
    }
  }
}
</script>

<style lang="sass">
.cwa-manager-tabs
  ul
    list-style: none
    margin: 0
    padding: 0
    > .cwa-manager-tab
      padding: 0
      > a
        padding: 1rem
        display: block
      &.is-selected > a
        color: $white
  .tab-content-container
    max-height: 20vh
    overflow: auto
  .tab-content
    padding: 0 1rem 1rem
</style>
