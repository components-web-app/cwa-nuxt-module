<template>
  <page-modal
    v-model="component"
    v-bind="iriModalProps"
    :is-loading="isLoading"
    :notifications="notifications"
    :page-components="pageComponents"
    :layouts="layouts"
    @close="$emit('close')"
    @submit="savePage"
    @delete="deleteComponent"
  />
</template>

<script lang="ts">
import Vue from 'vue'
import IriPageMixin from '../IriPageMixin'
// @ts-ignore
import LoadLayoutsMixin from '../LoadLayoutsMixin'
import PageModal from '../../../components/admin/page-modal.vue'
import IriPageModalMixin from '../IriPageModalMixin'

export default Vue.extend({
  components: { PageModal },
  mixins: [IriPageModalMixin, LoadLayoutsMixin, IriPageMixin('/_/pages')],
  head() {
    return {
      title: `Page Details - ${this.component.reference}`
    }
  },
  computed: {
    isSaved() {
      return this.$cwa.isResourceSame(this.component, this.savedComponent)
    }
  }
})
</script>
