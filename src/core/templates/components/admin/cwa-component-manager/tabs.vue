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
          {
            'is-selected': index === selectedTabIndex,
            'has-error':
              tabInputErrors[tab.label] &&
              !!tabInputErrors[tab.label].errorCount
          }
        ]"
      >
        <a href="#" @click.prevent="showTab(index)">{{ tab.label }}</a>
      </li>
    </ul>
    <transition-expand>
      <div v-show="showTabs" class="tab-content-container">
        <div ref="tabContent" class="tab-content">
          <component
            :is="tabComponent"
            v-if="tabComponent"
            :key="loopKey(`${selectedTab.label}-tab-content`, selectedTabIndex)"
            :iri="iri"
            :context="fullContext"
            :field-errors="tabInputErrors[selectedTab.label]"
            @draggable="toggleDraggable"
            @close="handleTabCloseEvent"
          />
        </div>
      </div>
    </transition-expand>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import type { PropType } from 'vue'
import { ComponentManagerTab } from '../../../../mixins/ComponentManagerMixin'
import {
  COMPONENT_MANAGER_EVENTS,
  TabChangedEvent,
  NOTIFICATION_EVENTS
} from '../../../../events'
import {
  NotificationEvent,
  RemoveNotificationEvent
} from '../../cwa-api-notifications/types'
import TransitionExpand from '../../utils/transition-expand.vue'

export default Vue.extend({
  components: { TransitionExpand },
  props: {
    tabs: {
      type: Array as PropType<ComponentManagerTab[]>,
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
    },
    showTabs: {
      type: Boolean,
      required: true
    }
  },
  data() {
    return {
      selectedTabIndex: null,
      tabInputErrors: {}
    }
  },
  computed: {
    tabComponent() {
      return this.$cwa.getResource(this.iri)
        ? this.selectedTab?.component || null
        : null
    },
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
        // using the iri results in tab being re-mounted
        // not ideal for the publishable toggle
        // ${this.iri}-
        return `${label}-${index}`
      }
    },
    selectedTab() {
      return this.orderedTabs[this.selectedTabIndex] || null
    }
  },
  watch: {
    selectedTab(newTab: ComponentManagerTab, previousTab: ComponentManagerTab) {
      this.$cwa.$eventBus.$emit(COMPONENT_MANAGER_EVENTS.tabChanged, {
        newTab,
        previousTab
      } as TabChangedEvent)
    },
    selectedPosition(newIri, oldIri) {
      if (newIri !== oldIri) {
        this.showTab(0)
      }
    },
    tabs: {
      handler(tabs: ComponentManagerTab[]) {
        this.tabInputErrors = {}
        for (const tab of tabs) {
          this.$set(this.tabInputErrors, tab.label, {
            errorCount: 0,
            notifications: {}
          })
        }
      },
      immediate: true
    },
    showTabs(newValue) {
      if (newValue) {
        this.showTab(0)
      }
    }
  },
  created() {
    this.$cwa.$eventBus.$on(
      NOTIFICATION_EVENTS.add,
      this.addNotificationListener
    )
    this.$cwa.$eventBus.$on(
      NOTIFICATION_EVENTS.remove,
      this.removeNotificationListener
    )
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off(
      NOTIFICATION_EVENTS.add,
      this.addNotificationListener
    )
    this.$cwa.$eventBus.$off(
      NOTIFICATION_EVENTS.remove,
      this.removeNotificationListener
    )
  },
  methods: {
    handleTabCloseEvent() {
      this.$emit('close')
    },
    showTab(newIndex) {
      this.selectedTabIndex = newIndex
    },
    toggleDraggable(isDraggable) {
      this.$emit('draggable', isDraggable)
    },
    addNotificationListener(notification: NotificationEvent) {
      const field = notification.field || 'default'
      for (const tab of this.tabs) {
        if (tab.inputFieldsUsed && tab.inputFieldsUsed.includes(field)) {
          if (!this.tabInputErrors[tab.label].notifications[field]) {
            this.$set(this.tabInputErrors[tab.label].notifications, field, [])
          }
          this.tabInputErrors[tab.label].notifications[field].push(notification)
          this.tabInputErrors[tab.label].errorCount++
        }
      }
    },
    removeNotificationListener(removeNotification: RemoveNotificationEvent) {
      const field = removeNotification.field || 'default'
      for (const tab of this.tabs) {
        const notifications =
          this.tabInputErrors[tab.label].notifications[field]
        if (notifications) {
          notifications.forEach((notification: NotificationEvent, index) => {
            if (notification.code === removeNotification.code) {
              notifications.splice(index, 1)
            }
          })
          this.tabInputErrors[tab.label].notifications[field] = notifications
        }
      }
    }
  }
})
</script>

<style lang="sass">
.cwa-manager-tabs
  ul
    list-style: none
    margin: 0
    padding: 0 .5rem
    > .cwa-manager-tab
      position: relative
      padding: 0
      > a
        padding: 1.5rem 1.5rem 2rem
        display: block
      &.is-selected > a
        color: $white
      &.has-error::after
        content: ''
        display: block
        position: absolute
        bottom: 100%
        left: 100%
        width: 12px
        height: 12px
        border-radius: 50%
        background-color: $cwa-danger
        transform: translate(-1.6rem, 1.8rem)
  .tab-content-container
    max-height: 20vh
    overflow: auto
  .tab-content
    padding: 0 2rem 2rem
</style>
