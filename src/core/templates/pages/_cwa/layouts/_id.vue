<template>
  <cwa-modal @close="$emit('close')" class="layout-details-page">
    <div class="status-bar">
      <status-icon />
      <error-notifications />
    </div>
    <div>
      <h2>Layout Details</h2>
    </div>
    <div class="row fields-container">
      <div class="column">
        <cwa-admin-text id="layout-reference" label="Reference" v-model="component.reference" :required="true" />
        <cwa-admin-select id="layout-ui" label="UI Component" v-model="component.uiComponent" :required="true" :options="$cwa.options.layouts" />
      </div>
      <div class="column">
        <div class="right-column-aligner">
          <div>
            <cwa-admin-text id="layout-classNames" label="Style classes" v-model="component.classNames" :required="true" />
          </div>
          <div v-if="!isNew" class="timestamps">
            <div>Updated: 00/00/00 @ 00:00 GMT</div>
            <div>Created: 00/00/00 @ 00:00 GMT</div>
          </div>
        </div>
      </div>
    </div>
    <div class="row buttons-row">
      <div class="column">
        <button @click="submit">Create</button>
      </div>
      <div v-if="!isNew" class="column is-narrow">
        <button class="is-dark is-delete">Delete</button>
      </div>
    </div>
  </cwa-modal>
</template>

<script>
import commonMixin from '../common-mixin'
import CwaModal from '../../../components/cwa-modal'
import CwaAdminText from '../../../components/admin/input/cwa-admin-text'
import StatusIcon from '../../../components/admin/status-icon'
import ErrorNotifications from '../../../components/admin/error-notifications'
import CwaAdminSelect from '../../../components/admin/input/cwa-admin-select'

export default {
  components: {CwaAdminSelect, ErrorNotifications, StatusIcon, CwaAdminText, CwaModal},
  mixins: [commonMixin],
  data() {
    return {
      iri: `/_/layouts`,
      component: {}
    }
  },
  async mounted() {
    if (this.isNew) {
      return
    }
    this.component = await this.$axios.$get(this.iri)
  },
  computed: {
    isNew() {
      return this.$route.params.id === 'add'
    }
  },
  methods: {
    async submit() {
      const classNames = this.component.classNames.split(',')
      const newResource = await this.$cwa.createResource('/_/layouts', {
        reference: this.component.reference,
        uiComponent: this.component.uiComponent,
        classNames
      })
      this.$emit('close')
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
</style>
