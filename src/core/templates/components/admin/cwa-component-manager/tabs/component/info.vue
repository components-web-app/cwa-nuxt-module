<template>
  <div class="collection-info-tab">
    <div class="row">
      <div class="column is-narrow">
        <info :id="inputId('id')" label="id" :value="resource['@id']" />
      </div>
      <div v-if="resource.createdAt || resource.modifiedAt" class="column">
        <info
          v-if="resource.createdAt"
          :id="inputId('createdAt')"
          label="created"
          :value="formatDate(parseDateString(resource.createdAt))"
        />
        <info
          v-if="resource.modifiedAt"
          :id="inputId('modifiedAt')"
          label="modified"
          :value="formatDate(parseDateString(resource.modifiedAt))"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Info from '../../input/info.vue'
import ApiDateParserMixin from '../../../../../../mixins/ApiDateParserMixin'

export default {
  components: { Info },
  mixins: [ApiDateParserMixin],
  props: {
    resource: {
      type: Object,
      required: true
    }
  },
  computed: {
    inputId() {
      return (name) => {
        return `${this.resource['@id']}-${name}`
      }
    }
  }
}
</script>

<style lang="sass">
.collection-info-tab
  font-size: 1.2rem
</style>
