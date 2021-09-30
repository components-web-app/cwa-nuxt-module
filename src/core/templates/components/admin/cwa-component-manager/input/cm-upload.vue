<template>
  <wrapper-component>
    <div class="cm-upload">
      <div class="row">
        <div class="column is-narrow">
          <div class="file">
            <label class="file-label" :for="id">
              <input
                :id="id"
                ref="file"
                :accept="accept"
                :disabled="uploading"
                class="file-input"
                type="file"
                @change="upload"
              />
              <cm-button @click="triggerUploadClick">
                {{ label }}
              </cm-button>
              <span v-if="uploading" class="upload-progress"
                ><span
                  class="bar"
                  :style="{ width: `${uploadPercentage}%` }"
                ></span
                ><span>{{ uploadPercentage }}%</span></span
              >
            </label>
          </div>
        </div>
        <div v-if="fileExists" class="column is-narrow">
          <a href="#" class="trash-link" @click.prevent="deleteUpload">
            <img
              src="../../../../../assets/images/icon-trash.svg"
              alt="Trash Icon"
            />
          </a>
        </div>
      </div>
    </div>
  </wrapper-component>
</template>
<script>
import ApiInputMixin from '../../../../../mixins/ApiInputMixin'
import CwaInputMixin from '../../input/CwaInputMixin'
import UpdateResourceMixin from '../../../../../mixins/UpdateResourceMixin.ts'
import WrapperComponent from './wrapper.vue'
import CmButton from './cm-button.vue'

export default {
  components: { CmButton, WrapperComponent },
  mixins: [ApiInputMixin, CwaInputMixin, UpdateResourceMixin],
  props: {
    notificationCategory: {
      required: false,
      default: 'components-manager',
      type: String
    },
    accept: {
      type: String,
      default: '*'
    }
  },
  data() {
    return {
      file: null,
      preview: null,
      uploadPercentage: 0,
      uploading: false,
      uploadError: null
    }
  },
  computed: {
    isFileImage() {
      return this.file && /\.(jpe?g|png|gif|svg)$/i.test(this.file.name)
    },
    fileExists() {
      return !!this.resource._metadata?.media_objects?.[this.field]
    }
  },
  methods: {
    loadImagePreview() {
      if (!this.isFileImage) {
        this.preview = null
      }
      const reader = new FileReader()
      reader.addEventListener(
        'load',
        function (file) {
          const image = new Image()
          image.src = file.target.result
          image.onload = () => {
            this.preview = {
              publicPath: image.src,
              width: image.width,
              height: image.height
            }
          }
        }.bind(this),
        false
      )
      reader.readAsDataURL(this.file)
    },
    async upload() {
      this.file = this.$refs.file.files[0]
      this.loadImagePreview()
      if (!this.file) {
        return
      }
      const formData = new FormData()
      formData.append(this.field, this.file)
      await this.submitRequest(formData)
    },
    async deleteUpload() {
      this.uploadError = null
      this.uploading = true
      await this.updateResource(this.iri, this.field, null)
      this.uploading = false
    },
    async submitRequest(formData) {
      this.clearAllViolationNotifications()
      this.uploadError = null
      this.uploading = true
      this.uploadPercentage = 0

      const axiosConfig = {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: function (progressEvent) {
          this.uploadPercentage = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          )
        }.bind(this)
      }

      try {
        await this.$cwa.updateResource(
          this.iri,
          {},
          null,
          [],
          async (_, query) => {
            const { data } = await this.$axios.post(
              `${this.iri}/upload${query}`,
              formData,
              axiosConfig
            )
            return data
          }
        )
      } catch (message) {
        throw this.handleUpdateError(
          message,
          this.notificationCategory,
          this.iri
        )
      }

      this.uploading = false
      this.preview = null
      this.$refs.file.value = ''
    },
    triggerUploadClick() {
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: false
      })
      this.$refs.file.dispatchEvent(clickEvent)
    }
  }
}
</script>

<style lang="sass">
.cm-upload
  > .row
    align-items: center
  .trash-link
    display: block
    opacity: .6
    padding: .15rem .15rem
    img
      width: .9em
      height: auto
    &:hover
      opacity: 1
  .file
    +no-select
    align-items: stretch
    display: flex
    justify-content: flex-start
    position: relative
  .file-label
    align-items: stretch
    display: flex
    cursor: pointer
    justify-content: flex-start
    overflow: hidden
    position: relative
    opacity: 1
  .file-input
    height: 100%
    left: 0
    opacity: 0
    outline: none
    position: absolute
    top: 0
    width: 100%
  .upload-progress
    position: absolute
    top: 0
    left: 0
    width: 100%
    height: 100%
    text-align: center
    background: $cwa-background-dark
    display: flex
    align-items: center
    justify-content: center
    .bar
      +no-select
      position: absolute
      background: $cwa-color-text-light
      opacity: .25
      height: 100%
      width: 100%
      border-radius: .4rem
    > span
      display: block
</style>
