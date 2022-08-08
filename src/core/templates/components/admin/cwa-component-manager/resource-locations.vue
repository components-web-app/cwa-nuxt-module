<template>
  <div class="resource-location">
    <span class="resource-label">
      {{ name || 'Unnamed' }}
    </span>
    <ul class="counters">
      <li v-if="locations.layouts" class="counter is-layouts">
        <span class="usage-icon"
          ><img
            src="../../../../assets/images/icon-layout.svg"
            alt="Layouts icon"
            :title="`Used in ${locations.layouts} layouts`"
        /></span>
        <span class="count">{{ locations.layouts }}</span>
      </li>
      <li v-if="locations.pages" class="counter is-pages">
        <span class="usage-icon"
          ><img
            src="../../../../assets/images/icon-pages.svg"
            alt="Pages icon"
            :title="`Used in ${locations.pages} pages`"
        /></span>
        <span class="count">{{ locations.pages }}</span>
      </li>
      <li v-if="locations.components" class="counter is-components">
        <span class="usage-icon"
          ><img
            src="../../../../assets/images/icon-components.svg"
            :title="`Used in ${locations.components} components`"
            alt="Components icon"
        /></span>
        <span class="count">{{ locations.components }}</span>
      </li>
    </ul>
  </div>
</template>

<script>
import consola from 'consola'
import IriMixin from '../../../../mixins/IriMixin'

export default {
  mixins: [IriMixin],
  props: {
    name: {
      type: String,
      required: false,
      default: null
    }
  },
  data() {
    return {
      fetchedResources: false
    }
  },
  computed: {
    // we will need to use the `findResource` method to ensure we have loaded all the relevant component locations and collections
    locations() {
      const resource =
        this.$cwa.getPublishedResource(this.resource) || this.resource
      const totals = {
        layouts: 0,
        pages: 0,
        components: 0
      }
      if (!resource) {
        return totals
      }
      if (resource['@type'] === 'ComponentCollection') {
        this.addCollectionTotals(resource, totals)
      } else if (resource.componentPositions) {
        resource.componentPositions.forEach((positionIri) => {
          const componentPosition = this.$cwa.getResource(positionIri)
          if (!componentPosition?.componentCollection) {
            return
          }
          const componentCollection = this.$cwa.getResource(
            componentPosition.componentCollection
          )
          if (!componentCollection) {
            if (this.fetchedResources) {
              consola.error(
                `Could not find component collection for resource`,
                resource
              )
            }
            return
          }
          this.addCollectionTotals(componentCollection, totals)
        })
      }

      return totals
    }
  },
  async mounted() {
    const resource =
      this.$cwa.getPublishedResource(this.resource) || this.resource
    const { componentPositions } = resource
    if (!!resource && !!componentPositions) {
      // we should ensure all the positions and collections have been resolved from the server
      // in future we may want to return the totals directly to the component for an admin
      const promises = []
      for (const positionIri of componentPositions) {
        promises.push(
          new Promise((resolve) => {
            this.$cwa.findResource(positionIri).then((pos) => {
              if (!pos) {
                resolve(true)
                return
              }
              this.$cwa.findResource(pos.componentCollection).then(() => {
                resolve(true)
              })
            })
          })
        )
      }
      await Promise.all(promises)
      this.fetchedResources = true
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
.resource-location
  position: relative
  display: flex
  align-items: center
  .resource-label
    transition: color .3s
  .usage-icon
    height: 1.1em
    width: auto
    img
      height: 100%
      display: block
  .counters
    display: inline-flex
    list-style: none
    margin: 0 0 0 .5em
    padding: 0
    .counter
      // padding-left: .5em
      display: flex
      position: relative
      align-items: center
      margin: 0
      &:not(:first-child)
        margin-left: .5em
      .count
        position: absolute
        font-size: .7em
        border-radius: .6em
        background: $cwa-navbar-background
        color: $cwa-color-text-light
        text-align: center
        line-height: 1.3em
        padding: 0 .5em
        bottom: 100%
        left: 100%
        transform: translate(-50%, 50%)
</style>
