<template>
  <div :class="['home-quick-link', resource.uiClassNames]">
    <div class="card">
      <div class="card-content">
        <div class="media">
          <div v-if="mediaObjects" class="media-left">
            <figure class="image">
              <img :src="imageSrc" alt="Image" />
            </figure>
          </div>
          <div class="media-content">
            <p class="title is-5">{{ resource.title || '--' }}</p>
            <p v-if="resource.description" class="subtitle is-6">
              {{ resource.description }}
            </p>
          </div>
        </div>
      </div>
      <footer class="card-footer">
        <cwa-nuxt-link :to="resource.url || '/'" class="card-footer-item"
          ><span>{{ resource.linkLabel || 'Click Here' }}</span></cwa-nuxt-link
        >
      </footer>
    </div>
  </div>
</template>
<script lang="ts">
import Vue from 'vue'
import ComponentMixin from '@cwa/nuxt-module/core/mixins/ComponentMixin'
import type { ComponentManagerTab } from '@cwa/nuxt-module/core/mixins/ComponentManagerMixin'
import CwaNuxtLink from '@cwa/nuxt-module/core/templates/components/utils/cwa-nuxt-link.vue'

export default Vue.extend({
  components: { CwaNuxtLink },
  mixins: [ComponentMixin],
  data() {
    return {
      componentManagerContext: {
        componentTab: {
          UiClassNames: [
            'is-introduction',
            'is-synthesis',
            'is-interventions',
            'is-diagram',
            'is-search',
            'is-visualise'
          ],
          UiComponents: null
        }
      }
    }
  },
  computed: {
    componentManagerTabs(): ComponentManagerTab[] {
      return [
        this.createCMTab(
          'Content',
          () => import('../admin-dialog/HomeQuickLink/HomeQuickLinkText.vue'),
          2
        ),
        this.createCMTab(
          'Link',
          () => import('../admin-dialog/HomeQuickLink/HomeQuickLinkLink.vue'),
          3
        ),
        this.createCMTab(
          'Image',
          () => import('../admin-dialog/HomeQuickLink/HomeQuickLinkImage.vue'),
          4
        )
      ]
    },
    imageObject() {
      return this.getMediaObject('file', 0)
    },
    imageSrc() {
      return `${this.getMediaObjectContentUrl(this.imageObject)}?${
        this.imageId
      }`
    },
    imageId() {
      return this.imageObject?.['@id']
    }
  }
})
</script>

<style lang="sass">
.home-quick-link
  height: 100%
  .card
    height: 100%
    display: flex
    flex-direction: column
    .card-content
      flex-grow: 1
      .media
        align-items: center
        height: 100%
        .image
          position: relative
          width: 92px
          height: 92px
          border-radius: 50%
          background: $blue
          img
            position: absolute
            top: 50%
            left: 50%
            transform: translate(-50%, -50%)
            width: 60%
    .card-footer
      border: 0
      background: $blue
      .card-footer-item
        color: $white
        justify-content: flex-end
        font-weight: $weight-bold
        > span
          position: relative
</style>
