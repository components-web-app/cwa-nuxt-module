<template>
  <div class="cwa-manager-tabs">
    <ul class="row">
      <li
        v-for="(tab, index) of tabs"
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
          v-for="(tab, index) of tabs"
          v-show="index === selectedTabIndex"
          :key="loopKey('tab-content', index)"
          :resource="resource"
        />
      </div>
    </div>
  </div>
</template>

<script>
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
    resourceId() {
      return this?.resource['@id'] || 'new'
    },
    loopKey() {
      return (label, index) => {
        return `${this.resourceId}-${label}-${index}`
      }
    }
  },
  methods: {
    showTab(newIndex) {
      this.selectedTabIndex = newIndex
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
