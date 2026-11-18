<script setup lang="ts">
import { ref } from 'vue'
import { CwaUiButton, CwaUiDialog, CwaUiFormSection, CwaUiInput, CwaUiSegmented, CwaUiSelect, CwaUiTextarea, CwaUiToggle } from '#components'
import CwaReveal from '../../../src/runtime/templates/components/core/ui/Reveal.vue'

const open = ref(false)
const reference = ref('Painted shaker')
const title = ref('Painted shaker kitchens | Hand-built')
const description = ref('Hand-built shaker kitchens, painted in any colour.')
const indexable = ref(true)
const nestedUnder = ref('none')
const parentPage = ref<string | null>(null)
const parentType = ref<string | null>(null)
const parentData = ref<string | null>(null)
const allowAi = ref(false)
const allowScrapers = ref(false)
const notes = ref('Photos to follow from the Kent workshop.')
const handover = ref('Ask Mia before changing the parent.')
const owner = ref('Mia')

const nestingOptions = [{ value: 'none', label: 'Nothing' }, { value: 'page', label: 'A page' }, { value: 'data', label: 'Page data' }]
const pageOptions = [{ label: 'Kitchens', value: '/_/pages/kitchens' }, { label: 'Shaker', value: '/_/pages/shaker' }]
const typeOptions = [{ label: 'Kitchen', value: 'KitchenData' }, { label: 'Bathroom', value: 'BathroomData' }]
const dataOptions = [{ label: 'Shaker kitchen 17', value: '/page_data/kitchens/17' }, { label: 'Shaker kitchen 18', value: '/page_data/kitchens/18' }]
</script>

<template>
  <div class="kit-stack">
    <div class="kit-row">
      <CwaUiButton
        label="Open the slide-over"
        data-testid="kit-reveal-open"
        @click="open = true"
      />
    </div>
    <CwaUiDialog
      v-if="open"
      title="Painted shaker"
      placement="right"
      data-testid="kit-reveal-dialog"
      @close="open = false"
    >
      <CwaUiFormSection>
        <CwaUiInput
          v-model="reference"
          label="Reference"
        />
      </CwaUiFormSection>
      <CwaUiFormSection title="Search engines">
        <CwaUiInput
          v-model="title"
          label="SEO page title"
        />
        <CwaUiTextarea
          v-model="description"
          label="SEO meta description"
        />
        <CwaUiToggle
          v-model="indexable"
          label="Allow your website to be indexed"
          data-testid="kit-reveal-indexable"
        />
        <CwaReveal :when="indexable">
          <CwaUiToggle
            v-model="allowScrapers"
            label="Allow non-SEO crawlers"
          />
          <CwaUiToggle
            v-model="allowAi"
            label="Allow AI bots"
          />
        </CwaReveal>
      </CwaUiFormSection>
      <CwaUiFormSection title="Nesting">
        <CwaUiSegmented
          v-model="nestedUnder"
          label="Nested under"
          :options="nestingOptions"
          data-testid="kit-reveal-nesting"
        />
        <CwaReveal :when="nestedUnder === 'page'">
          <CwaUiSelect
            v-model="parentPage"
            label="Parent page"
            :options="pageOptions"
            nullable
            data-testid="kit-reveal-parent-page"
          />
        </CwaReveal>
        <CwaReveal :when="nestedUnder === 'data'">
          <div
            class="kit-stack"
            data-testid="kit-reveal-parent-data"
          >
            <CwaUiSelect
              v-model="parentType"
              label="Parent data type"
              :options="typeOptions"
              nullable
            />
            <CwaUiSelect
              v-model="parentData"
              label="Parent data"
              :options="dataOptions"
              nullable
            />
            <p class="kit-note">
              A nested page's address starts with its parent's, so choose the parent before adding a route.
            </p>
          </div>
        </CwaReveal>
      </CwaUiFormSection>
      <CwaUiFormSection
        title="Notes"
        description="Only admins see these."
      >
        <CwaUiTextarea
          v-model="notes"
          label="Notes for editors"
        />
        <CwaUiTextarea
          v-model="handover"
          label="Handover"
        />
        <CwaUiInput
          v-model="owner"
          label="Owner"
        />
      </CwaUiFormSection>
    </CwaUiDialog>
  </div>
</template>
