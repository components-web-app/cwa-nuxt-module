<template>
  <div :class="['component-position', wrapperClass, { 'is-draft': isDraft }]">
    <client-only>
      <div
        v-if="
          $cwa.isAdmin && $cwa.isEditMode && !component && !newComponentResource
        "
        class="empty-component-position"
      >
        <icon-component />
      </div>
    </client-only>
    <resource-component-loader
      v-if="!!component && !newComponentResource"
      :component="`CwaComponents${component.uiComponent || component['@type']}`"
      :iri="componentIri"
      :sort-value="resource.sortValue"
      :show-sort="showSort"
      :highlight-is-position="highlightIsPosition"
      :is-dynamic="
        isDynamicPage &&
        resource._metadata.static_component !== resource.component
      "
      @deleted="$emit('deleted')"
    />
    <component
      :is="newComponentName"
      v-if="newComponentResource"
      :iri="newComponentIri"
      :is-dynamic="isDynamicPage && !!newComponentEvent.dynamicPage"
      @initial-data="handleInitialData"
    />
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import consola from 'consola'
import ResourceComponentLoader from '../../resource-component-loader'
// @ts-ignore
import IconComponent from '@cwa/nuxt-module/core/assets/images/icon-components.svg?inline'
import ComponentManagerMixin, {
  ComponentManagerTab,
  EVENTS
} from '@cwa/nuxt-module/core/mixins/ComponentManagerMixin'
import {
  API_EVENTS,
  COMPONENT_MANAGER_EVENTS,
  ComponentManagerResource,
  NewComponentEvent
} from '@cwa/nuxt-module/core/events'
import NewComponentMixin from '@cwa/nuxt-module/core/mixins/NewComponentMixin'
import CreateNewComponentEventMixin from '@cwa/nuxt-module/core/mixins/CreateNewComponentEventMixin'
import PageResourceUtilsMixin from '@cwa/nuxt-module/core/mixins/PageResourceUtilsMixin'
import components from '~/.nuxt/cwa/components'

export default Vue.extend({
  components: {
    ResourceComponentLoader,
    IconComponent,
    ...components
  },
  mixins: [
    ComponentManagerMixin,
    NewComponentMixin,
    CreateNewComponentEventMixin,
    PageResourceUtilsMixin
  ],
  props: {
    iri: {
      type: String,
      required: true
    },
    showSort: {
      type: Boolean,
      default: false,
      required: false
    }
  },
  data() {
    return {
      componentLoadFailed: false
    }
  },
  computed: {
    isDraft() {
      if (!this.componentIri) {
        return null
      }
      const storageResource = this.$cwa.getResource(this.componentIri)
      return storageResource?._metadata?.published === false || false
    },
    componentManagerTabs(): Array<ComponentManagerTab> {
      if (this.isDynamicPage) {
        return [
          {
            label: 'Manage Component',
            component: () =>
              import(
                '@cwa/nuxt-module/core/templates/components/admin/cwa-component-manager/tabs/component-position/add-dynamic-component.vue'
              ),
            context: {}
          }
        ]
      }

      const tabs: Array<ComponentManagerTab> = [
        {
          label: 'Static',
          component: () =>
            import(
              '@cwa/nuxt-module/core/templates/components/admin/cwa-component-manager/tabs/component-position/static-component.vue'
            ),
          context: {}
        },
        {
          label: 'Position Info',
          component: () =>
            import(
              '@cwa/nuxt-module/core/templates/components/admin/cwa-component-manager/tabs/component-position/info.vue'
            ),
          context: {}
        }
      ]

      if (this.isPageTemplate) {
        const refTab: ComponentManagerTab = {
          label: '#Ref',
          component: () =>
            import(
              '@cwa/nuxt-module/core/templates/components/admin/cwa-component-manager/tabs/component-position/dynamic-component.vue'
            ),
          context: {}
        }
        tabs.unshift(refTab)
      }

      return tabs
    },
    componentManager() {
      return Object.assign({}, this.baseComponentManager, {
        name: 'Component Position'
      })
    },
    resources() {
      return this.$cwa.resources
    },
    resource() {
      return this.$cwa.getResource(this.iri)
    },
    componentIri() {
      if (!this.resource.component) {
        return
      }
      return this.$cwa.getPublishableIri(this.resource.component)
    },
    component() {
      if (!this.resource) {
        return null
      }
      // may use `pageDataProperty` and not a specific component iri
      if (!this.componentIri) {
        return null
      }
      return this.$cwa.getResource(this.componentIri)
    },
    wrapperClass() {
      const normalize = (camel) => {
        return `component${camel}`.replace(
          /[A-Z]/g,
          (letter) => `-${letter.toLowerCase()}`
        )
      }
      return normalize(
        this.component
          ? this.$cwa.$storage.getTypeFromIri(this.componentIri)
          : '-empty'
      )
    }
  },
  async mounted() {
    // load the component if not loaded server-side (client-side has auth)
    // this will be called only if there is no component, otherwise resource mixin will deal with this stuff
    if (!this.component) {
      // check if no published version, only a draft (i.e. only an authorized viewer can see it)
      if (this.$cwa.user && this.resource.component) {
        await this.$cwa.fetcher.fetchResource(this.resource.component)
      }

      // wait for the component IRI to try and be fetched client-side and populated into storage
      this.$nextTick(async () => {
        // it is still not an object
        if (!this.component) {
          // it is not a dynamic position and we are an admin.. try to fetch this position again client-side
          if (!this.resource.pageDataProperty && this.$cwa.isAdmin) {
            await this.$cwa.fetcher.fetchResource(this.resource['@id'])
          }
          this.componentLoadFailed = true
        }
      })
    }

    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.newComponent,
      this.newComponentListener
    )
    this.$cwa.$eventBus.$on(API_EVENTS.newDraft, this.newDraftListener)
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.newComponent,
      this.newComponentListener
    )
    this.$cwa.$eventBus.$off(API_EVENTS.newDraft, this.newDraftListener)
  },
  methods: {
    componentManagerShowListener() {
      if (!this.resource) {
        consola.error(
          'Could not add component to component manager. No resource is defined',
          this
        )
        return
      }
      this.$cwa.$eventBus.$emit(EVENTS.addComponent, {
        data: this.componentManager,
        iri: this.iri
      } as ComponentManagerResource)
      this.$cwa.$eventBus.$emit(EVENTS.selectPosition, this.iri)
    },
    newDraftListener({ publishedIri, draftIri }) {
      if (this.resource.component === publishedIri && draftIri) {
        const resource = Object.assign({}, this.resource, {
          component: draftIri
        })
        this.$cwa.$storage.setResource({
          resource,
          isNew: false
        })
      }
    },
    newComponentListener(event: NewComponentEvent) {
      if (event.position !== this.iri) {
        return
      }
      this.newComponentEvent = event
    }
  }
})
</script>

<style lang="sass">
.component-position
  position: relative
  > *
    position: relative
    z-index: 1
  &.is-draft
    &::before
      content: ''
      position: absolute
      top: 0
      left: 0
      width: 100%
      height: 100%
      background: rgba($cwa-warning, .1)
      pointer-events: none
      z-index: 0
    &::after
      content: ''
      position: absolute
      bottom: 100%
      left: 100%
      width: 16px
      height: 16px
      border-radius: 50%
      background: $cwa-warning
      transform: translate(-8px, 8px)
      pointer-events: none
      z-index: 2
  .empty-component-position
    background: $white
    color: $cwa-background-dark
    padding: 1rem
    display: flex
    justify-content: center
    svg
      display: block
</style>
