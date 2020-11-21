<template>
  <div>
    <div v-if="!editing" v-html="displayHtml" />
    <quill-input v-else :iri="displayIri" field="html" @hide="editing = false" />
  </div>
</template>

<script>
import ComponentMixin from '@cwa/nuxt-module/core/mixins/ComponentMixin'
import QuillInput from '~/components/QuillInput'
export default {
  components: { QuillInput },
  mixins: [ComponentMixin],
  data () {
    return {
      editing: false,
      adminDialog: {
        name: 'HTML Content',
        component: () => import('../admin-dialog/HtmlContent.vue')
      }
    }
  },
  computed: {
    displayHtml () {
      return this.resource.html || (this.$cwa.isAdmin ? '<p style="font-style: italic">No content</p>' : '')
    }
  },
  methods: {
    showEditView () {
      this.editing = true
    }
  }
}
</script>
