<template>
  <li class="cwa-admin-dialog-item">
    <div class="header">
      {{ item.name || 'Unnamed' }}
      <span class="icons">
            <span v-if="locations.layouts" class="icon is-layouts">
              <span>{{ locations.layouts }}</span>
            </span>
            <span v-if="locations.pages" class="icon is-pages">
              <span>{{ locations.pages }}</span>
            </span>
            <span v-if="locations.components" class="icon is-components">
              <span>{{ locations.components }}</span>
            </span>
          </span>
    </div>
    <div class="item" v-if="item.component">
      <component :is="item.component" />
    </div>
  </li>
</template>

<script>
export default {
  props: {
    item: {
      type: Object,
      required: true
    }
  },
  computed: {
    locations() {
      const resource = this.item.resource
      const totals = {
        layouts: 0,
        pages: 0,
        components: 0
      }
      if (resource['@type'] === 'ComponentCollection') {
        this.addCollectionTotals(resource, totals)
      } else {
        if (resource.componentPositions) {
          resource.componentPositions.forEach((positionIri) => {
            const componentPosition = this.$cwa.resources.ComponentPosition.byId[positionIri]
            const componentCollection = this.$cwa.resources.ComponentCollection.byId[componentPosition.componentCollection]
            this.addCollectionTotals(componentCollection, totals)
          })
        }
      }

      return totals
    }
  },
  methods: {
    addCollectionTotals(resource, totals) {
      if (resource.layouts) {
        totals.layouts += resource.layouts.length
      }
      if (resource.pages) {
        totals.pages += resource.pages.length
      }
      if (resource.components) {
        totals.components += resource.components.length
      }
    }
  }
}
</script>

<style lang="sass">
.cwa-admin-dialog-item
  &:not(:last-child)
    margin-bottom: 1rem
  .header
    background: $cwa-grid-item-background
    padding: .5rem
    display: flex
    .icons
      margin-left: 1em
      display: inline-flex
      .icon
        padding-left: 1.2em
        display: flex
        position: relative
        align-items: center
        &:not(:first-child)
          margin-left: .5em
        span
          font-size: .7em
          display: inline-block
          border-radius: .6em
          background: $cwa-color-text-light
          color: $cwa-grid-item-background
          text-align: center
          line-height: 1.3em
          padding: 0 .5em
        &:before
          content: ''
          background: 0 50% no-repeat
          background-size: 100% auto
          position: absolute
          top: 0
          left: 0
          height: 100%
          width: .9em
          opacity: .6
        &.is-layouts:before
          background-image: url("../../../../assets/images/icon-layout.svg")
        &.is-pages:before
          background-image: url("../../../../assets/images/icon-pages.svg")
        &.is-components:before
          background-image: url("../../../../assets/images/icon-components.svg")
</style>
