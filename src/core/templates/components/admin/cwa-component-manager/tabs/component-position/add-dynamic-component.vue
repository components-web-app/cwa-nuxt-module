<template>
  <div class="add-dynamic-component-tab">
    <div class="row row-center">
      <div class="column is-narrow">
        <button type="button" @click.stop="addDynamicComponent">
          Add {{ pageDataPropComponent }}
        </button>
      </div>
      <div class="column is-narrow fallback">
        Want to add a fallback component?
        <nuxt-link
          :to="{ name: '_cwa_page_iri', params: { iri: pageResource.page } }"
          >Go to page template</nuxt-link
        >
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import PageResourceUtilsMixin from '../../../../../../mixins/PageResourceUtilsMixin'
import CreateNewComponentEventMixin from '../../../../../../mixins/CreateNewComponentEventMixin'
import { COMPONENT_MANAGER_EVENTS } from '@cwa/nuxt-module/core/events'

export default Vue.extend({
  mixins: [
    ComponentManagerTabMixin,
    PageResourceUtilsMixin,
    CreateNewComponentEventMixin
  ],
  computed: {
    pageDataPropComponent() {
      return this.getPageDataPropComponent(this.resource.pageDataProperty)
    }
  },
  methods: {
    async addDynamicComponent() {
      const newComponentEvent = await this.createNewComponentEvent(
        this.pageDataPropComponent,
        null,
        this.iri
      )
      // allow cwa manager to mount buttons to receive this event
      this.$nextTick(() => {
        this.$cwa.$eventBus.$emit(
          COMPONENT_MANAGER_EVENTS.newComponent,
          newComponentEvent
        )
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
