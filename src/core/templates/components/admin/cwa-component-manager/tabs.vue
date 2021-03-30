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
    <transition-expand>
      <div v-show="areTabsShowing" class="tab-content-container">
        <div ref="tabContent" class="tab-content">
          <component
            :is="tab.component"
            v-for="(tab, index) of orderedTabs"
            v-show="index === selectedTabIndex"
            :key="loopKey('tab-content', index)"
            :resource="resource"
            :context="tab.context"
            @draggable="toggleDraggable"
          />
        </div>
      </div>
    </transition-expand>
  </div>
</template>

<script lang="ts">
import { ComponentManagerTab } from '@cwa/nuxt-module/core/mixins/ComponentManagerMixin.ts'
import { COMPONENT_MANAGER_EVENTS } from '../../../../events'
import TransitionExpand from '../../utils/transition-expand.vue'

export default {
  components: { TransitionExpand },
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
      selectedTabIndex: null,
      areTabsShowing: false
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
      COMPONENT_MANAGER_EVENTS.selectComponent,
      this.resetTabSelector
    )
    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.showTabs,
      this.setTabsShowing
    )
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.selectComponent,
      this.resetTabSelector
    )
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.showTabs,
      this.setTabsShowing
    )
  },
  methods: {
    setTabsShowing(newValue) {
      if (newValue) {
        this.showTab(0)
      }
      this.$nextTick(() => {
        this.areTabsShowing = newValue
      })
    },
    showTab(newIndex) {
      this.selectedTabIndex = newIndex
    },
    resetTabSelector() {
      this.showTab(0)
    },
    toggleDraggable(isDraggable) {
      this.$emit('draggable', isDraggable)
    }
  }
}
</script>

<style lang="sass">
.cwa-manager-tabs
  ul
    list-style: none
    margin: 0
    padding: 0 .5rem
    > .cwa-manager-tab
      padding: 0
      > a
        padding: 1.5rem 1.5rem 2rem
        display: block
      &.is-selected > a
        color: $white
  .tab-content-container
    max-height: 20vh
    overflow: auto
  .tab-content
    padding: 0 2rem 2rem
</style>
