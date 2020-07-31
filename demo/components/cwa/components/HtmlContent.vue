<template>
  <div>
    <h4>My custom HtmlContent component. See the HTML below. That was easy!</h4>
    <div v-html="resource.html" />
    <text-input />
  </div>
</template>

<script>
import ComponentMixin from '@cwa/nuxt-module/core/mixins/ComponentMixin'
import TextInput from '~/components/TextInput'
export default {
  components: { TextInput },
  mixins: [ComponentMixin],
  computed: {
    contextMenuData () {
      return {
        Edit: {
          callback: this.showEditView
        }
      }
    }
  },
  methods: {
    showEditView () {
      alert('this will trigger edit view...')
    }
  }
}
</script>
