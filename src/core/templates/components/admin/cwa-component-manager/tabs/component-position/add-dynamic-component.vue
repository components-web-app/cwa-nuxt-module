<template>
  <div class="add-dynamic-component-tab">
    <div class="columns is-centered">
      <template v-if="resource.pageDataProperty">
        <div class="column is-narrow cm-button">
          <button
            v-if="pageDataPropIri"
            type="button"
            @click="selectDynamicComponent"
          >
            Select component
          </button>
          <button v-else type="button" @click.stop="addDynamicComponent">
            Add {{ pageDataPropComponent }}
          </button>
        </div>
        <div class="column is-narrow fallback">
          {{ resource._metadata.static_component ? 'Edit' : 'Add' }} fallback
          component?
          <a href="#" @click.prevent="goToTemplate">Go to page template</a>
        </div>
      </template>
      <template v-else>
        <div class="column is-narrow">This component is locked</div>
        <div class="column is-narrow cm-button">
          <button
            type="button"
            class="cm-button-button"
            @click.prevent="goToTemplate"
          >
            Edit via template
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import PageResourceUtilsMixin from '../../../../../../mixins/PageResourceUtilsMixin'
import CreateNewComponentEventMixin from '../../../../../../mixins/CreateNewComponentEventMixin'
import { COMPONENT_MANAGER_EVENTS } from '@cwa/nuxt-module/core/events'
import { EVENTS } from '@cwa/nuxt-module/core/mixins/ComponentManagerMixin'

export default Vue.extend({
  mixins: [
    ComponentManagerTabMixin,
    PageResourceUtilsMixin,
    CreateNewComponentEventMixin
  ],
  computed: {
    pageDataPropComponent() {
      return this.getPageDataPropComponent(this.resource.pageDataProperty)
    },
    pageDataPropIri() {
      return this.getDynamicComponentIri(this.resource.pageDataProperty)
    }
  },
  mounted() {
    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.componentCreated,
      this.handleComponentCreated
    )
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.componentCreated,
      this.handleComponentCreated
    )
  },
  methods: {
    selectDynamicComponent() {
      this.$cwa.$eventBus.$emit(EVENTS.selectComponent, this.pageDataPropIri)
    },
    async addDynamicComponent() {
      const newComponentEvent = await this.createNewComponentEvent(
        this.pageDataPropComponent,
        null,
        this.iri,
        {
          dynamicPage: this.pageResource['@id'],
          property: this.resource.pageDataProperty
        }
      )
      // allow cwa manager to mount buttons to receive this event
      this.$nextTick(() => {
        this.$cwa.$eventBus.$emit(
          COMPONENT_MANAGER_EVENTS.newComponent,
          newComponentEvent
        )
      })
    },
    goToTemplate() {
      this.$cwa.setEditMode(false)
      this.$router.push({
        name: '_cwa_page_iri',
        params: {
          iri: this.pageResource.page,
          cwa_force: 'true'
        }
      })
    }
  }
})
</script>

<style lang="sass">
.add-dynamic-component-tab
  button
    margin: 0
  .fallback
    font-size: .8em
</style>
