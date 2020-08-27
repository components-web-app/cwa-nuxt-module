<template>
  <div>
    <div v-if="!editing" @dblclick="showEditView" v-html="resource.html" />
    <text-input v-else :iri="iri" field="html" @hide="editing = false" />
  </div>
</template>

<script>
import ComponentMixin from '@cwa/nuxt-module/core/mixins/ComponentMixin'
import TextInput from '~/components/TextInput'
export default {
  components: { TextInput },
  mixins: [ComponentMixin],
  data () {
    return {
      editing: false
    }
  },
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
      this.editing = true
    }
  }
}
</script>
