<template>
  <div class="cwa-admin-dialog-form">
    <div class="cwa-input">
      <label for="ui-classes">Style Classes</label>
      <input id="ui-classes" v-model="uiClassNames" type="text">
    </div>
    <div class="cwa-input">
      <button class="is-size-6 submit-button" :disabled="submitting" @click="submitRequest">
        Create
      </button>
    </div>
  </div>
</template>

<script>
import ApiRequestMixin from '@cwa/nuxt-module/core/mixins/ApiRequestMixin'
import CommaDelimitedArrayBuilder from '../../../../src/utils/CommaDelimitedArrayBuilder'

export default {
  mixins: [ApiRequestMixin],
  props: {
    componentCollection: {
      type: String,
      required: true
    }
  },
  data () {
    return {
      uiClassNames: null,
      submitting: false
    }
  },
  methods: {
    async submitRequest () {
      this.submitting = true
      try {
        const uiClassNames = CommaDelimitedArrayBuilder(this.uiClassNames)
        await this.$cwa.createResource('/component/html_contents', {
          componentPositions: [
            {
              componentCollection: this.componentCollection
            }
          ],
          uiClassNames
        })
      } catch (error) {
        this.handleApiError(error)
      } finally {
        this.submitting = false
      }
    },
    async reloadComponentCollection () {

    }
  }
}
</script>

<style lang="sass">
.cwa-admin-dialog-form
  .submit-button
    width: 100%
    margin: 0
</style>
