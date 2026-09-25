<template>
  <ListHeading
    title="Orphaned resources"
    hide-add
  />
  <ListContainer class="cwa:relative cwa:py-10">
    <div class="cwa:flex cwa:flex-col cwa:gap-y-6">
      <CwaUiAlertWarning v-if="loadError || scanError">
        {{ loadError || scanError }}
      </CwaUiAlertWarning>
      <p
        v-if="scanPending"
        class="cwa:text-sm cwa:font-bold"
      >
        The scan has been requested but has not finished yet. Reload this page in a moment to see the new report.
      </p>
      <Spinner
        v-if="loading"
        :show="true"
      />
      <div
        v-else-if="hasReport === false"
        data-testid="orphaned-no-scan"
        class="cwa:flex cwa:flex-col cwa:gap-y-4"
      >
        <p class="cwa:text-sm cwa:text-stone-300">
          No scan has been run yet. A scan finds component groups, component positions and components that are no longer used anywhere on the site. Nothing is deleted unless you choose to delete it.
        </p>
        <div>
          <CwaUiFormButton
            color="blue"
            :disabled="busy"
            type="button"
            @click="scan"
          >
            {{ scanning ? 'Scanning…' : 'Scan' }}
          </CwaUiFormButton>
        </div>
      </div>
      <template v-else-if="hasReport">
        <div
          data-testid="orphaned-summary"
          class="cwa:flex cwa:flex-col cwa:gap-y-4"
        >
          <div class="cwa:text-sm cwa:text-stone-300 cwa:flex cwa:flex-col cwa:gap-y-1">
            <p class="cwa:text-light cwa:font-bold">
              Last scanned {{ formatDateTime(generatedAt) }}
            </p>
            <p>This report reflects that scan. Resources you delete here are removed from it, and anything else that has changed since appears when you scan again.</p>
          </div>
          <div class="cwa:flex cwa:flex-wrap cwa:gap-4">
            <CwaUiFormButton
              :disabled="busy"
              type="button"
              @click="scan"
            >
              {{ scanning ? 'Scanning…' : 'Scan again' }}
            </CwaUiFormButton>
            <CwaUiFormButton
              color="error"
              :disabled="busy || !totalCount"
              type="button"
              @click="deleteAll"
            >
              Delete everything
            </CwaUiFormButton>
          </div>
        </div>
        <div
          v-for="section of sections"
          :key="section.key"
          :data-testid="`orphaned-section-${section.key}`"
        >
          <hr class="cwa:mb-8 cwa:text-stone-600">
          <div class="cwa:flex cwa:items-center cwa:justify-between cwa:gap-x-4 cwa:mb-4">
            <h2 class="cwa:text-xl">
              {{ section.title }} ({{ section.rows.length }})
            </h2>
            <CwaUiFormButton
              v-if="section.rows.length"
              color="error"
              :disabled="busy"
              type="button"
              @click="deleteSection(section)"
            >
              Delete all
            </CwaUiFormButton>
          </div>
          <p
            v-if="!section.rows.length"
            class="cwa:text-sm cwa:text-stone-400"
          >
            No orphaned {{ section.plural }}.
          </p>
          <ul v-else>
            <li
              v-for="row of section.rows"
              :key="row.iri"
              class="cwa:border-b cwa:border-b-stone-700 cwa:py-4"
            >
              <div class="cwa:flex cwa:items-center cwa:gap-x-4">
                <div class="cwa:grow cwa:min-w-0 cwa:flex cwa:flex-col cwa:gap-y-1">
                  <span
                    data-testid="orphaned-row-iri"
                    class="cwa:font-mono cwa:text-sm cwa:break-all"
                  >{{ row.iri }}</span>
                  <span
                    v-if="row.collection"
                    class="cwa:text-xs cwa:text-stone-400"
                  >{{ row.collection }}</span>
                </div>
                <CwaUiFormButton
                  type="button"
                  @click="toggleView(row)"
                >
                  {{ row.viewOpen ? 'Hide' : 'View' }}
                </CwaUiFormButton>
                <CwaUiFormButton
                  color="error"
                  :disabled="busy"
                  type="button"
                  @click="deleteRow(section, row)"
                >
                  {{ row.deleting ? 'Deleting…' : 'Delete' }}
                </CwaUiFormButton>
              </div>
              <p
                v-if="row.error"
                class="cwa:text-sm cwa:text-danger cwa:font-bold cwa:mt-2"
              >
                {{ row.error }}
              </p>
              <div
                v-if="row.viewOpen"
                class="cwa:mt-3"
              >
                <Spinner
                  v-if="row.viewLoading"
                  :show="true"
                />
                <p
                  v-else-if="row.viewError"
                  class="cwa:text-sm cwa:text-danger cwa:font-bold"
                >
                  {{ row.viewError }}
                </p>
                <pre
                  v-else
                  class="cwa:text-xs cwa:bg-stone-800 cwa:text-stone-200 cwa:p-4 cwa:overflow-auto cwa:max-h-96"
                >{{ JSON.stringify(row.viewData, null, 2) }}</pre>
              </div>
            </li>
          </ul>
        </div>
      </template>
    </div>
  </ListContainer>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue'
import ListHeading from '#cwa/templates/components/core/admin/ListHeading.vue'
import ListContainer from '#cwa/templates/components/core/admin/ListContainer.vue'
import Spinner from '#cwa/templates/components/utils/Spinner.vue'
import { formatDateTime } from '#cwa/resources/date-time-input'
import { useOrphanedResources } from '#cwa-layer/_composables/useOrphanedResources'
import { definePageMeta, useHead } from '#imports'

useHead({
  title: 'Orphaned Resources',
})

definePageMeta({
  name: '_cwa-orphaned',
  pageTransition: false,
})

const {
  loading,
  hasReport,
  generatedAt,
  loadError,
  scanError,
  scanning,
  scanPending,
  busy,
  sections,
  totalCount,
  loadReport,
  scan,
  toggleView,
  deleteRow,
  deleteSection,
  deleteAll,
} = useOrphanedResources()

onMounted(loadReport)
</script>
