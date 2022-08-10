<template>
  <div class="cwa-manager-tabs columns is-gapless">
    <div v-if="showSideTabs" class="side-bar column is-narrow">
      <div class="columns is-gapless is-multiline">
        <div class="column">
          <div
            :class="[
              'button',
              'is-fullwidth',
              iriIsComponent ? 'is-light' : 'is-dark'
            ]"
            @click.prevent="selectResource(sideTabComponent)"
          >
            Static
          </div>
        </div>
        <div class="column">
          <div
            :class="[
              'button',
              'is-fullwidth',
              iriIsPosition ? 'is-light' : 'is-dark'
            ]"
            @click.prevent="selectResource(sideTabPosition)"
          >
            #Ref
          </div>
        </div>
      </div>
    </div>
    <div class="main column">
      <div class="main-manager-section">
        <div class="columns tabs-top">
          <div class="column">
            <ul class="columns tabs-list">
              <li
                v-for="tab of topTabs"
                :key="loopKey('tab', tab._index)"
                :class="[
                  'column',
                  'is-narrow',
                  'cwa-manager-tab',
                  {
                    'is-selected': tab._index === selectedTabIndex,
                    'has-error':
                      tabInputErrors[tab.label] &&
                      !!tabInputErrors[tab.label].errorCount
                  }
                ]"
              >
                <a href="#" @click.prevent="showTab(tab._index)">{{
                  tab.label
                }}</a>
              </li>
            </ul>
          </div>
          <div class="column is-narrow">
            <cwa-action-buttons
              :selected-position="selectedPosition"
              :selected-component="selectedComponent"
              @close="$emit('close')"
            />
          </div>
        </div>
        <transition-expand>
          <div
            v-show="showTabs && dynamicTabMounted"
            class="tab-content-container"
          >
            <div ref="tabContent" class="tab-content">
              <component
                :is="tabComponent"
                v-if="tabComponent"
                :key="
                  loopKey(`${selectedTab.label}-tab-content`, selectedTabIndex)
                "
                :iri="iri"
                :context="fullContext"
                :field-errors="tabInputErrors[selectedTab.label]"
                @draggable="toggleDraggable"
                @close="handleTabCloseEvent"
                @show-tab="showTabListener"
                @hook:mounted="handleDynamicTabMounted"
              />
            </div>
          </div>
        </transition-expand>
      </div>
    </div>
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
import PageResourceUtilsMixin from '../../../../mixins/PageResourceUtilsMixin'
import CwaActionButtons from './cwa-action-buttons.vue'

export default Vue.extend({
  components: { CwaActionButtons, TransitionExpand },
  mixins: [PageResourceUtilsMixin],
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
    },
    selectedComponent: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      selectedTabIndex: null,
      tabInputErrors: {},
      dynamicTabMounted: false
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
        this.selectedTab?.context || {}
      )
    },
    orderedTabs() {
      const sortFn = (
        itemA: ComponentManagerTab,
        itemB: ComponentManagerTab
      ) => {
        const priorityA = itemA.priority || 0
        const priorityB = itemB.priority || 0
        return priorityA - priorityB
      }
      return [...this.tabs]
        .sort(sortFn)
        .map((item, index) => ({ ...item, _index: index }))
    },
    topTabs() {
      return this.orderedTabs // .filter((tab) => !tab.sideBar)
    },
    showSideTabs() {
      if (
        this.isDynamicPage ||
        !this.isPageTemplate ||
        !this.positionResourceComponentIri
      ) {
        return
      }
      return this.iriIsPosition || this.iriIsComponent
    },
    sideTabPosition() {
      if (!this.showSideTabs) {
        return null
      }
      return this.selectedPosition
    },
    sideTabComponent() {
      if (!this.showSideTabs) {
        return null
      }
      if (this.iriIsPosition) {
        return this.positionResourceComponentIri
      }
      return this.iri
    },
    iriIsPosition() {
      return this.iri === this.selectedPosition
    },
    positionResourceComponentIri() {
      return this.selectedPosition
        ? this.$cwa.getResource(this.selectedPosition).component
        : null
    },
    iriIsComponent() {
      return this.positionResourceComponentIri === this.iri
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
        previousTab,
        context: this.fullContext
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
    // added listener for adding a new component from the component position using the dropdown
    // position tab is 2nd for adding a new static component, so needed to reset - if knock-ons, the tab component
    // can emit show-tab event locally instead
    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.newComponent,
      this.newComponentListener
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
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.newComponent,
      this.newComponentListener
    )
  },
  methods: {
    showTabListener(newTabIndex: number) {
      this.showTab(newTabIndex)
    },
    newComponentListener() {
      this.showTab(0)
    },
    selectResource(iri) {
      this.$cwa.$eventBus.$emit(COMPONENT_MANAGER_EVENTS.selectComponent, iri)
      this.showTab(0)
    },
    handleDynamicTabMounted() {
      setTimeout(() => {
        this.dynamicTabMounted = true
      }, 10)
    },
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
.cwa-manager-tabs.columns.is-gapless
  margin: 0
  .main-manager-section
    padding: calc($gap/2)
  .columns.tabs-top
    margin-bottom: 0
    align-items: center
  .side-bar
    background-color: $cwa-background-dark
    > .columns
      height: 100%
      align-items: center
      flex-direction: column
      padding: calc($gap/2)
      &:hover,
      &.is-selected
        border-color: $white
        color: $white
      > .column
        display: flex
        justify-content: center
        align-content: center
        align-items: center
        width: 100%
  ul.tabs-list
    list-style: none
    margin: 0
    padding: 0
    > .cwa-manager-tab
      position: relative
      padding: 0
      > a
        padding: .5rem 1rem
        margin-right: .75rem
        border-radius: 8px
        display: block
        position: relative
      &.is-selected > a
        color: $white
        background: $cwa-control-background-color
      &.has-error > a::after
        content: ''
        display: block
        position: absolute
        bottom: 100%
        left: 100%
        width: 12px
        height: 12px
        border-radius: 50%
        background-color: $cwa-danger
        transform: translate(-6px, 6px)
  .tab-content-container
    max-height: 20vh
    overflow: auto
  .tab-content
    display: flex
    align-items: center
    padding: .25rem .75rem .25rem
    min-height: 70px
    .columns.tab-row
      min-height: 36px
      align-items: center
    .trash-link
      display: block
      opacity: .6
      padding: .15rem .15rem
      img
        width: .9em
        height: auto
      &:hover
        opacity: 1
</style>
