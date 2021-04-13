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
            :is="selectedTab.component"
            v-if="selectedTab"
            :key="loopKey('tab-content', selectedTabIndex)"
            :iri="iri"
            :context="fullContext"
            @draggable="toggleDraggable"
            @close="$emit('close')"
          />
        </div>
      </div>
    </transition-expand>
  </div>
</template>

<script lang="ts">
import { ComponentManagerTab } from '../../../../mixins/ComponentManagerMixin'
import { COMPONENT_MANAGER_EVENTS, TabChangedEvent } from '../../../../events'
import TransitionExpand from '../../utils/transition-expand.vue'

export default {
  components: { TransitionExpand },
  props: {
    tabs: {
      type: Array,
      required: true
    },
    iri: {
      type: String,
      required: false,
      default: null
    },
    selectedPosition: {
      type: String,
      required: false,
      default: null
    },
    collection: {
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
    fullContext() {
      return Object.assign(
        {
          componentPosition: this.selectedPosition,
          collection: this.collection
        },
        this.selectedTab.context
      )
    },
    orderedTabs() {
      return [...this.tabs].sort(
        (itemA: ComponentManagerTab, itemB: ComponentManagerTab) => {
          const priorityA = itemA.priority || 0
          const priorityB = itemB.priority || 0
          return priorityA - priorityB
        }
      )
    },
    loopKey() {
      return (label, index) => {
        return `${this.iri}-${label}-${index}`
      }
    },
    selectedTab() {
      return this.orderedTabs[this.selectedTabIndex] || null
    }
  },
  watch: {
    selectedTab(newTab, previousTab) {
      this.$cwa.$eventBus.$emit(COMPONENT_MANAGER_EVENTS.tabChanged, {
        newTab,
        previousTab
      } as TabChangedEvent)
    }
  },
  mounted() {
    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.selectComponent,
      this.selectComponentListener
    )
    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.showTabs,
      this.setTabsShowing
    )
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.selectComponent,
      this.selectComponentListener
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
        setTimeout(() => {
          this.areTabsShowing = newValue
        }, 100)
      })
    },
    showTab(newIndex) {
      this.selectedTabIndex = newIndex
    },
    selectComponentListener(iri) {
      if (iri !== this.iri) {
        this.showTab(0)
      }
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
