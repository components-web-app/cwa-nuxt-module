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
        <admin-input id="layout-reference" label="Reference" v-model="component.reference" :required="true" />
        <admin-input id="layout-ui" label="UI Component" v-model="component.uiComponent" :required="true" />
      </div>
      <div class="column">
        <div class="right-column-aligner">
          <div>
            <admin-input id="layout-classNames" label="Style classes" v-model="component.classNames" :required="true" />
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
        <button>Create</button>
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
import AdminInput from '../../../components/admin/admin-input'
import StatusIcon from '../../../components/admin/status-icon'
import ErrorNotifications from '../../../components/admin/error-notifications'

export default {
  components: {ErrorNotifications, StatusIcon, AdminInput, CwaModal},
  mixins: [commonMixin],
  data() {
    return {
      iri: `/_/layouts`,
      component: {}
    }
  },
  computed: {
    isNew() {
      return this.$route.params.id === 'add'
    }
  },
  async mounted() {
    if (this.isNew) {
      return
    }
    this.component = await this.$axios.$get(this.iri)
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
