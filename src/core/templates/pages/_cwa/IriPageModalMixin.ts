import Vue from 'vue'
// @ts-ignore
import pageComponents from '~/.nuxt/cwa/pages'

// Use IriModalMixin or IriPageMixin with this mixin.
export default Vue.extend({
  data() {
    return {
      pageComponents: Object.keys(pageComponents).map((item) =>
        item.replace(/^CwaPages/, '')
      ),
      component: {
        reference: ''
      }
    }
  },
  methods: {
    async savePage(submitEventParams = null) {
      const uiClassNames = this.component?.uiClassNames
        ?.split(',')
        .map((item) => item.trim())
      const data = Object.assign(
        {
          title: ''
        },
        this.component,
        {
          uiClassNames
        }
      )
      await this.sendRequest(data, submitEventParams)
    }
  }
})
