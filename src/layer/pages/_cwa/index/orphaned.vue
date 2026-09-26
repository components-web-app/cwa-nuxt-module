<template>
  <ListHeading
    title="Orphaned resources"
    hide-add
  />
  <ListContainer class="cwa:relative cwa:py-10">
    <div class="cwa:flex cwa:flex-col cwa:gap-y-6">
      <CwaUiAlertWarning v-if="loadError || scanError || deleteError">
        {{ loadError || scanError || deleteError }}
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
            <p>This report reflects that scan. Anything you delete here is checked again first, and the report is updated afterwards. Anything else that has changed since appears when you scan again.</p>
          </div>
          <div
            v-if="deleteOutcome"
            data-testid="orphaned-delete-outcome"
            class="cwa:text-sm cwa:flex cwa:flex-col cwa:gap-y-2"
          >
            <p class="cwa:font-bold">
              {{ deleteOutcome.summary }}
            </p>
            <ul
              v-if="deleteOutcome.rejected.length"
              class="cwa:flex cwa:flex-col cwa:gap-y-1"
            >
              <li
                v-for="item of deleteOutcome.rejected"
                :key="item.iri"
                class="cwa:flex cwa:flex-wrap cwa:gap-x-2"
              >
                <span class="cwa:font-mono cwa:break-all">{{ item.iri }}</span>
                <span class="cwa:text-stone-400">{{ item.reason }}</span>
              </li>
            </ul>
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
            v-if="section.error"
            class="cwa:text-sm cwa:text-danger cwa:font-bold cwa:mb-4"
          >
            {{ section.error }}
          </p>
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
                  @click="deleteRow(row)"
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
      <section
        data-testid="orphaned-files"
        class="cwa:flex cwa:flex-col cwa:gap-y-6"
      >
        <hr class="cwa:text-stone-600">
        <h2 class="cwa:text-2xl">
          Files
        </h2>
        <CwaUiAlertWarning v-if="files.loadError.value || files.scanError.value || files.deleteError.value">
          {{ files.loadError.value || files.scanError.value || files.deleteError.value }}
        </CwaUiAlertWarning>
        <p
          v-if="files.scanPending.value"
          class="cwa:text-sm cwa:font-bold"
        >
          The file scan has been requested but has not finished yet. Reload this page in a moment to see the new report.
        </p>
        <Spinner
          v-if="files.loading.value"
          :show="true"
        />
        <div
          v-else-if="files.hasReport.value === false"
          data-testid="orphaned-files-no-scan"
          class="cwa:flex cwa:flex-col cwa:gap-y-4"
        >
          <p class="cwa:text-sm cwa:text-stone-300">
            No file scan has been run yet. A file scan finds uploaded files that nothing on the site uses any more, and rows whose file is missing from storage. Nothing is deleted unless you choose to delete it.
          </p>
          <div>
            <CwaUiFormButton
              color="blue"
              :disabled="files.busy.value"
              type="button"
              @click="files.scan"
            >
              {{ files.scanning.value ? 'Scanning…' : 'Scan files' }}
            </CwaUiFormButton>
          </div>
        </div>
        <template v-else-if="files.hasReport.value">
          <div
            data-testid="orphaned-files-summary"
            class="cwa:flex cwa:flex-col cwa:gap-y-4"
          >
            <div class="cwa:text-sm cwa:text-stone-300 cwa:flex cwa:flex-col cwa:gap-y-1">
              <p class="cwa:text-light cwa:font-bold">
                Last scanned {{ formatDateTime(files.generatedAt.value) }}
              </p>
              <p>This report reflects that scan. Any file you delete here is checked again first, and the report is updated afterwards.</p>
            </div>
            <div
              v-if="files.deleteOutcome.value"
              data-testid="orphaned-files-delete-outcome"
              class="cwa:text-sm cwa:flex cwa:flex-col cwa:gap-y-2"
            >
              <p class="cwa:font-bold">
                {{ files.deleteOutcome.value.summary }}
              </p>
              <ul
                v-if="files.deleteOutcome.value.rejected.length"
                class="cwa:flex cwa:flex-col cwa:gap-y-1"
              >
                <li
                  v-for="item of files.deleteOutcome.value.rejected"
                  :key="item.path"
                  class="cwa:flex cwa:flex-wrap cwa:gap-x-2"
                >
                  <span class="cwa:font-mono cwa:break-all">{{ item.path }}</span>
                  <span class="cwa:text-stone-400">{{ item.reason }}</span>
                </li>
              </ul>
            </div>
            <div class="cwa:flex cwa:flex-wrap cwa:gap-4">
              <CwaUiFormButton
                :disabled="files.busy.value"
                type="button"
                @click="files.scan"
              >
                {{ files.scanning.value ? 'Scanning…' : 'Scan files' }}
              </CwaUiFormButton>
              <CwaUiFormButton
                color="error"
                :disabled="files.busy.value || !files.totalCount.value"
                type="button"
                @click="files.deleteAll"
              >
                Delete everything
              </CwaUiFormButton>
            </div>
          </div>
          <div data-testid="orphaned-files-section-orphaned">
            <div class="cwa:flex cwa:items-center cwa:justify-between cwa:gap-x-4 cwa:mb-4">
              <h3 class="cwa:text-xl">
                Orphaned files ({{ files.orphanedFiles.rows.length }})
              </h3>
              <CwaUiFormButton
                v-if="files.orphanedFiles.rows.length"
                color="error"
                :disabled="files.busy.value"
                type="button"
                @click="files.deleteSection"
              >
                Delete all
              </CwaUiFormButton>
            </div>
            <p
              v-if="files.orphanedFiles.error"
              class="cwa:text-sm cwa:text-danger cwa:font-bold cwa:mb-4"
            >
              {{ files.orphanedFiles.error }}
            </p>
            <p
              v-if="!files.orphanedFiles.rows.length"
              class="cwa:text-sm cwa:text-stone-400"
            >
              No orphaned files.
            </p>
            <ul v-else>
              <li
                v-for="row of files.orphanedFiles.rows"
                :key="row.key"
                data-testid="orphaned-file-row"
                class="cwa:border-b cwa:border-b-stone-700 cwa:py-4"
              >
                <div class="cwa:flex cwa:items-center cwa:gap-x-4">
                  <div class="cwa:grow cwa:min-w-0 cwa:flex cwa:flex-col cwa:gap-y-1">
                    <span class="cwa:font-mono cwa:text-sm cwa:break-all">{{ row.path }}</span>
                    <span class="cwa:text-xs cwa:text-stone-400">{{ row.adapter }}</span>
                  </div>
                  <CwaUiFormButton
                    color="error"
                    :disabled="files.busy.value"
                    type="button"
                    @click="files.deleteRow(row)"
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
              </li>
            </ul>
          </div>
          <div data-testid="orphaned-files-section-missing">
            <h3 class="cwa:text-xl cwa:mb-2">
              Missing files ({{ files.missingFiles.rows.length }})
            </h3>
            <p class="cwa:text-sm cwa:text-stone-400 cwa:mb-4">
              The file each of these points to does not exist in storage. They are reported only; fix them by uploading the file again or editing the resource.
            </p>
            <p
              v-if="!files.missingFiles.rows.length"
              class="cwa:text-sm cwa:text-stone-400"
            >
              No missing files.
            </p>
            <ul v-else>
              <li
                v-for="row of files.missingFiles.rows"
                :key="row.key"
                data-testid="orphaned-file-row"
                class="cwa:border-b cwa:border-b-stone-700 cwa:py-4"
              >
                <div class="cwa:flex cwa:items-center cwa:gap-x-4">
                  <div class="cwa:grow cwa:min-w-0 cwa:flex cwa:flex-col cwa:gap-y-1">
                    <span class="cwa:font-mono cwa:text-sm cwa:break-all">{{ row.iri }}</span>
                    <span class="cwa:font-mono cwa:text-xs cwa:break-all">{{ row.path }}</span>
                    <span class="cwa:text-xs cwa:text-stone-400">{{ row.adapter }}</span>
                  </div>
                  <CwaUiFormButton
                    type="button"
                    @click="files.toggleView(row)"
                  >
                    {{ row.viewOpen ? 'Hide' : 'View' }}
                  </CwaUiFormButton>
                </div>
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
      </section>
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
import { useOrphanedFiles } from '#cwa-layer/_composables/useOrphanedFiles'
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
  deleteOutcome,
  deleteError,
  sections,
  totalCount,
  loadReport,
  scan,
  toggleView,
  deleteRow,
  deleteSection,
  deleteAll,
} = useOrphanedResources()

const files = useOrphanedFiles()

onMounted(() => {
  loadReport()
  files.loadReport()
})
</script>
