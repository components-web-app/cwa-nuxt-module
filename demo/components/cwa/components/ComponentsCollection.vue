<template>
  <div class="components-collection">
    <div class="row filters">
      <div class="column">
        <collection-search-input :search-fields="['title']" />
      </div>
      <div class="column is-narrow">order</div>
      <div class="column is-narrow">perpage</div>
    </div>
    <div class="collection-items">
      <div v-if="fetching" class="loading-overlay">&nbsp;</div>
      <div class="row row-wrap">
        <blog-article-collection-item
          v-for="item of items"
          :key="`blog-item-${item['@id']}`"
          :iri="item['@id']"
          class="column column-50"
        />
      </div>
    </div>
    <collection-pagination :collection="resource.collection" />
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import CollectionComponentMixin from '@cwa/nuxt-module/core/mixins/CollectionComponentMixin'
import BlogArticleCollectionItem from '~/components/collection/BlogArticleCollectionItem.vue'
import CollectionPagination from '~/components/collection/CollectionPagination.vue'
import CollectionSearchInput from '~/components/collection/CollectionSearchInput.vue'

export default Vue.extend({
  components: {
    CollectionSearchInput,
    CollectionPagination,
    BlogArticleCollectionItem
  },
  mixins: [CollectionComponentMixin],
  data() {
    return {
      collectionSubResourceKeys: ['route']
    }
  }
})
</script>

<style lang="sass">
.components-collection
  .collection-items
    position: relative
    margin-top: 1.5rem
    .loading-overlay
      position: absolute
      background: rgba($white, .4)
      top: 0
      left: 0
      width: 100%
      height: 100%
      z-index: 10
</style>
