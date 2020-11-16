<script lang="ts">
import CommonMixin from '../CommonMixin'
import page from '../../../page'
export default {
  extends: page,
  mixins: [CommonMixin],
  async mounted() {
    await this.$cwa.fetcher.fetchPage(this.currentPageTemplateIri)
  },
  computed: {
    currentPageMetadata() {
      return this.resources.Page?.byId[this.currentPageTemplateIri]
    },
    currentPageTemplateIri() {
      return decodeURIComponent(this.$route.params.iri)
    }
  }
}
</script>
