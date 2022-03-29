<template>
  <div :class="['component-position', wrapperClass, { 'is-draft': isDraft }]">
    <client-only>
      <div v-if="$cwa.isAdmin">
        <div v-if="!component">
          <button>Select position</button>
        </div>
        <div
          v-show="
            isDynamicPage && !dynamicComponentIri && !!pageDataPropComponent
          "
        >
          <button
            v-if="!newComponentResource"
            type="button"
            @click.stop="addDynamicComponent"
          >
            Add {{ pageDataPropComponent }}
          </button>
          <span v-else>
            [ If page data has '{{ resource.pageDataProperty }}', it will show
            here instead. ]
          </span>
        </div>
      </div>
    </client-only>

    <resource-component-loader
      v-if="!!component"
      :component="`CwaComponents${component.uiComponent || component['@type']}`"
      :iri="componentIri"
      :sort-value="resource.sortValue"
      :show-sort="showSort"
      :highlight-is-position="highlightIsPosition"
      @deleted="$emit('deleted')"
    />

    <component
      :is="newComponentName"
      v-if="newComponentResource"
      :iri="newComponentIri"
      @initial-data="handleInitialData"
    />
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import consola from 'consola'
import ResourceComponentLoader from '../../resource-component-loader'
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
import type { ComponentCreatedEvent } from '@cwa/nuxt-module/core/events'
import components from '~/.nuxt/cwa/components'

export default Vue.extend({
  components: {
    ResourceComponentLoader,
    ...components
  },
  mixins: [
    ComponentManagerMixin,
    NewComponentMixin,
    CreateNewComponentEventMixin
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
      const storageResource = this.$cwa.getResource(this.componentIri)
      return storageResource?._metadata?.published === false || false
    },
    dynamicComponentIri() {
      return this.pageResource[this.resource.pageDataProperty]
    },
    componentManagerTabs(): Array<ComponentManagerTab> {
      return [
        {
          label: 'Dynamic',
          component: () =>
            import(
              '@cwa/nuxt-module/core/templates/components/admin/cwa-component-manager/tabs/component-position/dynamic-component.vue'
            ),
          context: {}
        },
        {
          label: 'Static',
          component: () =>
            import(
              '@cwa/nuxt-module/core/templates/components/admin/cwa-component-manager/tabs/component-position/static-component.vue'
            ),
          context: {}
        },
        {
          label: 'Info',
          component: () =>
            import(
              '@cwa/nuxt-module/core/templates/components/admin/cwa-component-manager/tabs/component-position/info.vue'
            ),
          context: {}
        }
      ]
    },
    componentManager() {
      return Object.assign({}, this.baseComponentManager, {
        name: 'Component Position'
      })
    },
    resources() {
      return this.$cwa.resources
    },
    pageDataPropComponent() {
      return this.pageDataProps?.[this.resource.pageDataProperty] || null
    },
    pageDataProps() {
      return (
        this.pageResource._metadata?.page_data_metadata?.properties.reduce(
          (obj, item) => {
            obj[item.property] = item.componentShortName
            return obj
          },
          {}
        ) || {}
      )
    },
    pageResource() {
      return this.$cwa.getResource(this.$cwa.loadedPage)
    },
    isDynamicPage() {
      return this.pageResource?.['@type'] !== 'Page'
    },
    resource() {
      return this.$cwa.getResource(this.iri)
    },
    componentIri() {
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
    // load the component if not loaded
    if (!this.component) {
      // check if no published version, only a draft (i.e. only an authorized viewer can see it)
      if (this.$cwa.user && this.resource.component) {
        await this.$cwa.fetcher.fetchComponent(this.resource.component)
      }

      this.$nextTick(async () => {
        if (!this.component) {
          if (!this.resource.pageDataProperty && this.$cwa.isAdmin) {
            await this.$cwa.fetcher.fetchComponent(this.resource['@id'])
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
    this.$cwa.$eventBus.$on(
      EVENTS.componentCreated,
      this.handleComponentCreated
    )
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.newComponent,
      this.newComponentListener
    )
    this.$cwa.$eventBus.$off(API_EVENTS.newDraft, this.newDraftListener)
    this.$cwa.$eventBus.$off(
      EVENTS.componentCreated,
      this.handleComponentCreated
    )
  },
  methods: {
    async handleComponentCreated(event: ComponentCreatedEvent) {
      if (
        !this.newComponentEvent ||
        event.tempIri !== this.newComponentEvent.iri
      ) {
        return
      }
      await this.$cwa.updateResource(
        this.pageResource['@id'],
        {
          [this.resource.pageDataProperty]: event.newIri
        },
        null,
        [this.resource['@id']]
      )
    },
    async addDynamicComponent() {
      this.newComponentEvent = await this.createNewComponentEvent(
        this.pageDataPropComponent
      )
      // allow cwa manager to mount buttons to receive this event
      this.$nextTick(() => {
        this.$cwa.$eventBus.$emit(
          COMPONENT_MANAGER_EVENTS.newComponent,
          this.newComponentEvent
        )
      })
    },
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
</style>
