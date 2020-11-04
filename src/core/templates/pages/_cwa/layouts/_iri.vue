<template>
  <cwa-modal @close="$emit('close')" class="layout-details-page">
    <div class="status-bar">
      <status-icon />
      <error-notifications />
    </div>
    <div>
      <h2>Layout Details</h2>
    </div>
    <section class="details-section">
      <div class="row fields-container">
        <div class="column">
          <cwa-admin-text id="layout-reference" label="Reference" v-model="component.reference" :required="true" />
          <cwa-admin-select id="layout-ui" label="UI Component" v-model="component.uiComponent" :required="true" :options="Object.keys($cwa.options.layouts)" />
        </div>
        <div class="column">
          <div class="right-column-aligner">
            <div>
              <cwa-admin-text id="layout-classNames" label="Style classes" v-model="component.classNames" :required="true" />
            </div>
            <div v-if="!isNew" class="timestamps">
              <div>Updated: {{ formatDate(parseDateString(component.modifiedAt)) }} UTC</div>
              <div>Created: {{ formatDate(parseDateString(component.createdAt)) }} UTC</div>
            </div>
          </div>
        </div>
      </div>
      <div class="row buttons-row">
        <div class="column">
          <button @click="submit">{{ isNew ? 'Create' : 'Save' }}</button>
        </div>
        <div v-if="!isNew" class="column is-narrow">
          <button @click="deleteLayout" class="is-dark is-delete">Delete</button>
        </div>
      </div>
      <transition name="fade">
        <div v-if="loading" class="loader-overlay">
          <cwa-loader />
        </div>
      </transition>
    </section>
  </cwa-modal>
</template>

<script>
import CommonMixin from '../common-mixin'
import CwaModal from '../../../components/cwa-modal'
import CwaAdminText from '../../../components/admin/input/cwa-admin-text'
import StatusIcon from '../../../components/admin/status-icon'
import ErrorNotifications from '../../../components/admin/error-notifications'
import CwaAdminSelect from '../../../components/admin/input/cwa-admin-select'
import ApiDateParserMixin from '../../../../mixins/ApiDateParserMixin'
import CwaLoader from '../../../components/cwa-loader'

export default {
  components: {CwaLoader, CwaAdminSelect, ErrorNotifications, StatusIcon, CwaAdminText, CwaModal},
  mixins: [CommonMixin, ApiDateParserMixin],
  data() {
    return {
      iri: decodeURIComponent(this.$route.params.iri),
      component: {},
      loading: true
    }
  },
  async mounted() {
    if (this.isNew) {
      this.loading = false
      return
    }
    this.component = await this.$axios.$get(this.iri)
    this.loading = false
  },
  computed: {
    isNew() {
      return this.$route.params.iri === 'add'
    }
  },
  methods: {
    async submit() {
      this.loading = true
      const classNames = this.component?.classNames?.split(',')
      const data = {
        reference: this.component.reference,
        uiComponent: this.component.uiComponent,
        classNames
      }
      if (this.isNew) {
        await this.$cwa.createResource('/_/layouts', data)
      } else {
        await this.$cwa.updateResource(this.iri, data)
      }
      this.$emit('change')
      // this.loading = false
    },
    async deleteLayout() {
      this.loading = true
      await this.$cwa.deleteResource(this.iri)
      this.$emit('change')
      // this.loading = false
    }
  }
}
</script>

<style lang="sass">
.layout-details-page
  .status-bar
    position: absolute
    top: 2rem
    left: 2rem
    display: flex
  .fields-container
    .right-column-aligner
      display: flex
      flex-direction: column
      height: 100%
      justify-content: space-between
    .timestamps
      margin-top: 1rem
      text-align: right
      color: $cwa-color-text-light
      font-size: 1.3rem
      justify-self: end
  .buttons-row
    margin-top: 2.5rem
    button.is-delete
      &:hover
        border-color: $cwa-danger
        background: $cwa-danger
        color: $white
  .details-section
    position: relative
  .loader-overlay
    position: absolute
    top: 0
    left: 0
    width: 100%
    height: 100%
    background: rgba($cwa-navbar-background, .9)
</style>
