<template>
  <iri-modal-view
    v-model="component"
    v-bind="iriModalProps"
    :title="`New ${resourceName}`"
    class="cwa-dynamic-page-modal"
    @close="$emit('close')"
    @submit="addCollectionResource"
  >
    <template slot="left">
      <div class="cwa-input">
        <label>Resource</label>
        <p>
          {{ resourceName }}
          <span class="text-small">({{ endpoint }})</span>
        </p>
      </div>
      <cwa-admin-select
        v-model="component.page"
        label="Page template"
        :options="pageOptions"
        v-bind="inputProps('page')"
      />
    </template>
  </iri-modal-view>
</template>

<script lang="ts">
import Vue from 'vue'
import CwaAdminSelect from '@cwa/nuxt-module/core/templates/components/admin/input/cwa-admin-select.vue'
import IriModalMixin from '@cwa/nuxt-module/core/templates/pages/_cwa/IriModalMixin'
import ApiError from '@cwa/nuxt-module/inc/api-error'
import IriModalView from '../iri-modal-view.vue'

export default Vue.extend({
  components: { CwaAdminSelect, IriModalView },
  mixins: [IriModalMixin],
  props: {
    defaultData: {
      type: Object,
      required: false,
      default() {
        return {}
      }
    },
    resourceName: {
      type: String,
      required: true
    },
    endpoint: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      iri: 'add',
      pageOptions: [],
      component: {
        ...this.defaultData
      },
      showLoader: false
    }
  },
  async mounted() {
    this.showLoader = true
    const { data } = await this.$axios.get('/_/pages')
    const pages = data['hydra:member']
    this.pageOptions = pages.map((page) => {
      return {
        value: page['@id'],
        label: page.reference
      }
    })
    this.showLoader = false
  },
  methods: {
    async addCollectionResource() {
      this.showLoader = true
      try {
        await this.$cwa.createResource(this.endpoint, this.component, null, [])
        this.$emit('refresh')
      } catch (error) {
        this.handleResourceRequestError(error, this.endpoint)
        return false
      } finally {
        this.showLoader = false
      }
    }
  }
})
</script>

<style lang="sass">
.cwa-dynamic-page-modal
  .text-small
    font-size: 1.1rem
</style>
