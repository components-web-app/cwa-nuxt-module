<template>
  <page-modal
    v-if="iri"
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
  <div v-else>INTERNAL ERROR: NO PAGE IRI FOUND</div>
</template>

<script lang="ts">
import Vue from 'vue'
import IriPageModalMixin from '../../pages/_cwa/IriPageModalMixin'
import LoadLayoutsMixin from '../../pages/_cwa/LoadLayoutsMixin'
import IriModalMixin from '../../pages/_cwa/IriModalMixin'
import PageModal from './page-modal.vue'

export default Vue.extend({
  components: { PageModal },
  mixins: [IriPageModalMixin, LoadLayoutsMixin, IriModalMixin],
  data() {
    return {
      // I don't know why this causes an error not realising $cwa is available on Vue instance...
      // @ts-ignore
      iri: this.$cwa.currentPageIri
    }
  }
})
</script>
