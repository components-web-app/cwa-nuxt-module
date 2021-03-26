<template>
  <div class="path-breadcrumbs">
    <ul class="row">
      <path-breadcrumb
        v-for="(component, componentIndex) in components"
        :key="`path-breadcrumb-${component.resource['@id']}`"
        class="column is-narrow"
        :name="component.data.name"
        :resource="component.resource"
        :is-selected="componentIndex === 0"
        @click="$emit('click', { componentIndex })"
      />
    </ul>
  </div>
</template>

<script>
import PathBreadcrumb from './path-breadcrumb.vue'
export default {
  components: { PathBreadcrumb },
  props: {
    components: {
      type: Array,
      required: true
    }
  }
}
</script>

<style lang="sass">
.path-breadcrumbs
  > ul
    list-style: none
    margin: 0
    padding: 0
    align-items: center
    font-size: 1.3rem
</style>
