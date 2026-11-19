<template>
  <ListHeading
    title="Orphaned resources"
    hide-add
  />
  <ListContainer class="cwa:relative cwa:pt-4 cwa:pb-16">
    <section
      data-testid="orphaned-resources"
      aria-labelledby="orphaned-resources-heading"
      :aria-busy="loading ? 'true' : undefined"
      class="cwa:flex cwa:flex-col cwa:gap-y-stack"
    >
      <h2
        id="orphaned-resources-heading"
        class="cwa:m-0 cwa:text-title cwa:text-fg"
      >
        Resources
      </h2>
      <CwaUiAlert
        v-if="loadError || scanError || deleteError"
        tone="danger"
        :title="loadError || scanError || deleteError || ''"
        data-testid="orphaned-error"
      />
      <CwaUiAlert
        v-if="scanPending"
        tone="info"
        title="The scan has been requested but has not finished yet."
        data-testid="orphaned-pending"
      >
        <p class="cwa:m-0">
          Reload this page in a moment to see the new report.
        </p>
      </CwaUiAlert>
      <p
        v-if="loading"
        class="cwa:m-0 cwa:flex cwa:items-center cwa:gap-2 cwa:text-control cwa:text-fg-muted"
      >
        <Spinner />Loading the report…
      </p>
      <div
        v-else-if="hasReport === false"
        data-testid="orphaned-no-scan"
        class="cwa:flex cwa:flex-col cwa:items-start cwa:gap-y-4"
      >
        <p class="cwa:m-0 cwa:text-control cwa:text-fg-secondary">
          No scan has been run yet. A scan finds component groups, component positions and components that are no longer used anywhere on the site. Nothing is deleted unless you choose to delete it.
        </p>
        <CwaUiButton
          variant="solid"
          :label="scanning ? 'Scanning…' : 'Scan'"
          :loading="scanning"
          :disabled="busy && !scanning"
          :disabled-reason="busyReason"
          @click="scan"
        />
      </div>
      <template v-else-if="hasReport">
        <div
          data-testid="orphaned-summary"
          class="cwa:flex cwa:flex-col cwa:items-start cwa:gap-y-4"
        >
          <div class="cwa:flex cwa:flex-col cwa:gap-y-1 cwa:text-control">
            <p class="cwa:m-0 cwa:font-semibold cwa:text-fg">
              Last scanned {{ formatDateTime(generatedAt) }}
            </p>
            <p class="cwa:m-0 cwa:text-fg-muted">
              This report reflects that scan. Anything you delete here is checked again first, and the report is updated afterwards. Anything else that has changed since appears when you scan again.
            </p>
          </div>
          <CwaUiAlert
            v-if="deleteOutcome"
            :tone="deleteOutcome.rejected.length ? 'warning' : 'success'"
            :title="deleteOutcome.summary"
            data-testid="orphaned-delete-outcome"
            class="cwa:self-stretch"
          >
            <ul
              v-if="deleteOutcome.rejected.length"
              class="cwa:m-0 cwa:flex cwa:list-none cwa:flex-col cwa:gap-y-1 cwa:p-0"
            >
              <li
                v-for="item of deleteOutcome.rejected"
                :key="item.iri"
                class="cwa:flex cwa:flex-wrap cwa:gap-x-2"
              >
                <CopyableText
                  :text="item.iri"
                  class="cwa:break-all cwa:font-mono cwa:text-fg"
                />
                <span>{{ item.reason }}</span>
              </li>
            </ul>
          </CwaUiAlert>
          <div class="cwa:flex cwa:flex-wrap cwa:gap-actions">
            <CwaUiButton
              :label="scanning ? 'Scanning…' : 'Scan again'"
              :loading="scanning"
              :disabled="busy && !scanning"
              :disabled-reason="busyReason"
              @click="scan"
            />
            <CwaUiButton
              tone="danger"
              label="Delete everything"
              :disabled="busy || !totalCount"
              :disabled-reason="busy ? busyReason : 'Nothing is orphaned.'"
              @click="deleteAll"
            />
          </div>
        </div>
        <div>
          <CwaUiFormSection
            v-for="section of sections"
            :key="section.key"
            :title="`${section.title} (${section.rows.length})`"
            :data-testid="`orphaned-section-${section.key}`"
          >
            <template
              v-if="section.rows.length"
              #action
            >
              <CwaUiButton
                tone="danger"
                label="Delete all"
                :aria-label="`Delete all ${section.plural}`"
                :disabled="busy"
                :disabled-reason="busyReason"
                @click="deleteSection(section)"
              />
            </template>
            <p
              v-if="section.error"
              class="cwa:m-0 cwa:text-helper cwa:text-danger-fg"
            >
              {{ section.error }}
            </p>
            <p
              v-if="!section.rows.length"
              class="cwa:m-0 cwa:text-control cwa:text-fg-muted"
            >
              No orphaned {{ section.plural }}.
            </p>
            <ul
              v-else
              class="cwa:m-0 cwa:list-none cwa:p-0"
            >
              <OrphanRow
                v-for="row of section.rows"
                :key="row.iri"
              >
                <CopyableText
                  :text="row.iri"
                  data-testid="orphaned-row-iri"
                  class="cwa:break-all cwa:font-mono cwa:text-control cwa:text-fg"
                />
                <span
                  v-if="row.collection"
                  class="cwa:text-helper cwa:text-fg-muted"
                >{{ row.collection }}</span>
                <p
                  v-if="row.error"
                  class="cwa:m-0 cwa:text-helper cwa:text-danger-fg"
                >
                  {{ row.error }}
                </p>
                <template #actions>
                  <CwaUiButton
                    size="sm"
                    :label="row.viewOpen ? 'Hide' : 'View'"
                    :aria-label="`${row.viewOpen ? 'Hide' : 'View'} ${row.iri}`"
                    @click="toggleView(row)"
                  />
                  <CwaUiButton
                    size="sm"
                    tone="danger"
                    :label="row.deleting ? 'Deleting…' : 'Delete'"
                    :aria-label="`Delete ${row.iri}`"
                    :loading="row.deleting"
                    :disabled="busy && !row.deleting"
                    :disabled-reason="busyReason"
                    @click="deleteRow(row)"
                  />
                </template>
                <template
                  v-if="row.viewOpen"
                  #detail
                >
                  <OrphanRowView
                    :loading="row.viewLoading"
                    :error="row.viewError"
                    :data="row.viewData"
                    :label="`Data of ${row.iri}`"
                  />
                </template>
              </OrphanRow>
            </ul>
          </CwaUiFormSection>
        </div>
      </template>
    </section>
    <section
      data-testid="orphaned-files"
      aria-labelledby="orphaned-files-heading"
      :aria-busy="files.loading.value ? 'true' : undefined"
      class="cwa:mt-section cwa:flex cwa:flex-col cwa:gap-y-stack cwa:border-t cwa:border-line cwa:pt-section"
    >
      <h2
        id="orphaned-files-heading"
        class="cwa:m-0 cwa:text-title cwa:text-fg"
      >
        Files
      </h2>
      <CwaUiAlert
        v-if="files.loadError.value || files.scanError.value || files.deleteError.value"
        tone="danger"
        :title="files.loadError.value || files.scanError.value || files.deleteError.value || ''"
        data-testid="orphaned-files-error"
      />
      <CwaUiAlert
        v-if="files.scanPending.value"
        tone="info"
        title="The file scan has been requested but has not finished yet."
        data-testid="orphaned-files-pending"
      >
        <p class="cwa:m-0">
          Reload this page in a moment to see the new report.
        </p>
      </CwaUiAlert>
      <p
        v-if="files.loading.value"
        class="cwa:m-0 cwa:flex cwa:items-center cwa:gap-2 cwa:text-control cwa:text-fg-muted"
      >
        <Spinner />Loading the file report…
      </p>
      <div
        v-else-if="files.hasReport.value === false"
        data-testid="orphaned-files-no-scan"
        class="cwa:flex cwa:flex-col cwa:items-start cwa:gap-y-4"
      >
        <p class="cwa:m-0 cwa:text-control cwa:text-fg-secondary">
          No file scan has been run yet. A file scan finds uploaded files that nothing on the site uses any more, and rows whose file is missing from storage. Nothing is deleted unless you choose to delete it.
        </p>
        <CwaUiButton
          variant="solid"
          :label="files.scanning.value ? 'Scanning…' : 'Scan files'"
          :loading="files.scanning.value"
          :disabled="files.busy.value && !files.scanning.value"
          :disabled-reason="busyReason"
          @click="files.scan"
        />
      </div>
      <template v-else-if="files.hasReport.value">
        <div
          data-testid="orphaned-files-summary"
          class="cwa:flex cwa:flex-col cwa:items-start cwa:gap-y-4"
        >
          <div class="cwa:flex cwa:flex-col cwa:gap-y-1 cwa:text-control">
            <p class="cwa:m-0 cwa:font-semibold cwa:text-fg">
              Last scanned {{ formatDateTime(files.generatedAt.value) }}
            </p>
            <p class="cwa:m-0 cwa:text-fg-muted">
              This report reflects that scan. Any file you delete here is checked again first, and the report is updated afterwards.
            </p>
          </div>
          <CwaUiAlert
            v-if="files.deleteOutcome.value"
            :tone="files.deleteOutcome.value.rejected.length ? 'warning' : 'success'"
            :title="files.deleteOutcome.value.summary"
            data-testid="orphaned-files-delete-outcome"
            class="cwa:self-stretch"
          >
            <ul
              v-if="files.deleteOutcome.value.rejected.length"
              class="cwa:m-0 cwa:flex cwa:list-none cwa:flex-col cwa:gap-y-1 cwa:p-0"
            >
              <li
                v-for="item of files.deleteOutcome.value.rejected"
                :key="item.path"
                class="cwa:flex cwa:flex-wrap cwa:gap-x-2"
              >
                <CopyableText
                  :text="item.path"
                  kind="path"
                  class="cwa:break-all cwa:font-mono cwa:text-fg"
                />
                <span>{{ item.reason }}</span>
              </li>
            </ul>
          </CwaUiAlert>
          <div class="cwa:flex cwa:flex-wrap cwa:gap-actions">
            <CwaUiButton
              :label="files.scanning.value ? 'Scanning…' : 'Scan files'"
              :loading="files.scanning.value"
              :disabled="files.busy.value && !files.scanning.value"
              :disabled-reason="busyReason"
              @click="files.scan"
            />
            <CwaUiButton
              tone="danger"
              label="Delete everything"
              aria-label="Delete every orphaned file"
              :disabled="files.busy.value || !files.totalCount.value"
              :disabled-reason="files.busy.value ? busyReason : 'No file is orphaned.'"
              @click="files.deleteAll"
            />
          </div>
        </div>
        <div>
          <CwaUiFormSection
            :title="`Orphaned files (${files.orphanedFiles.rows.length})`"
            data-testid="orphaned-files-section-orphaned"
          >
            <template
              v-if="files.orphanedFiles.rows.length"
              #action
            >
              <CwaUiButton
                tone="danger"
                label="Delete all"
                aria-label="Delete all orphaned files"
                :disabled="files.busy.value"
                :disabled-reason="busyReason"
                @click="files.deleteSection"
              />
            </template>
            <p
              v-if="files.orphanedFiles.error"
              class="cwa:m-0 cwa:text-helper cwa:text-danger-fg"
            >
              {{ files.orphanedFiles.error }}
            </p>
            <p
              v-if="!files.orphanedFiles.rows.length"
              class="cwa:m-0 cwa:text-control cwa:text-fg-muted"
            >
              No orphaned files.
            </p>
            <ul
              v-else
              class="cwa:m-0 cwa:list-none cwa:p-0"
            >
              <OrphanRow
                v-for="row of files.orphanedFiles.rows"
                :key="row.key"
                data-testid="orphaned-file-row"
              >
                <CopyableText
                  :text="row.path"
                  kind="path"
                  class="cwa:break-all cwa:font-mono cwa:text-control cwa:text-fg"
                />
                <span class="cwa:text-helper cwa:text-fg-muted">{{ row.adapter }}</span>
                <p
                  v-if="row.error"
                  class="cwa:m-0 cwa:text-helper cwa:text-danger-fg"
                >
                  {{ row.error }}
                </p>
                <template #actions>
                  <CwaUiButton
                    size="sm"
                    tone="danger"
                    :label="row.deleting ? 'Deleting…' : 'Delete'"
                    :aria-label="`Delete ${row.path} (${row.adapter})`"
                    :loading="row.deleting"
                    :disabled="files.busy.value && !row.deleting"
                    :disabled-reason="busyReason"
                    @click="files.deleteRow(row)"
                  />
                </template>
              </OrphanRow>
            </ul>
          </CwaUiFormSection>
          <CwaUiFormSection
            :title="`Unknown files (${files.unknownFiles.rows.length})`"
            description="Nothing references these, but they do not look like files the CWA uploaded, so something else may own them. They are reported only and Delete everything skips them. Remove them from storage directly if you are sure, or exclude their location in the API's orphaned_files.excluded_paths."
            data-testid="orphaned-files-section-unknown"
          >
            <p
              v-if="!files.unknownFiles.rows.length"
              class="cwa:m-0 cwa:text-control cwa:text-fg-muted"
            >
              No unknown files.
            </p>
            <ul
              v-else
              class="cwa:m-0 cwa:list-none cwa:p-0"
            >
              <OrphanRow
                v-for="row of files.unknownFiles.rows"
                :key="row.key"
                data-testid="orphaned-file-row"
              >
                <CopyableText
                  :text="row.path"
                  kind="path"
                  class="cwa:break-all cwa:font-mono cwa:text-control cwa:text-fg"
                />
                <span class="cwa:text-helper cwa:text-fg-muted">{{ row.adapter }}</span>
              </OrphanRow>
            </ul>
          </CwaUiFormSection>
          <CwaUiFormSection
            :title="`Missing files (${files.missingFiles.rows.length})`"
            description="The file each of these points to does not exist in storage. They are reported only; fix them by uploading the file again or editing the resource."
            data-testid="orphaned-files-section-missing"
          >
            <p
              v-if="!files.missingFiles.rows.length"
              class="cwa:m-0 cwa:text-control cwa:text-fg-muted"
            >
              No missing files.
            </p>
            <ul
              v-else
              class="cwa:m-0 cwa:list-none cwa:p-0"
            >
              <OrphanRow
                v-for="row of files.missingFiles.rows"
                :key="row.key"
                data-testid="orphaned-file-row"
              >
                <CopyableText
                  :text="row.iri"
                  class="cwa:break-all cwa:font-mono cwa:text-control cwa:text-fg"
                />
                <CopyableText
                  :text="row.path"
                  kind="path"
                  class="cwa:break-all cwa:font-mono cwa:text-helper cwa:text-fg-secondary"
                />
                <span class="cwa:text-helper cwa:text-fg-muted">{{ row.adapter }}</span>
                <template #actions>
                  <CwaUiButton
                    size="sm"
                    :label="row.viewOpen ? 'Hide' : 'View'"
                    :aria-label="`${row.viewOpen ? 'Hide' : 'View'} ${row.iri}`"
                    @click="files.toggleView(row)"
                  />
                </template>
                <template
                  v-if="row.viewOpen"
                  #detail
                >
                  <OrphanRowView
                    :loading="row.viewLoading"
                    :error="row.viewError"
                    :data="row.viewData"
                    :label="`Data of ${row.iri}`"
                  />
                </template>
              </OrphanRow>
            </ul>
          </CwaUiFormSection>
          <CwaUiFormSection
            :title="`Invalid files (${files.invalidFiles.rows.length})`"
            description="These files are in use but break their upload field's current rules, so they are never deleted from here. Open the resource and upload a replacement."
            data-testid="orphaned-files-section-invalid"
          >
            <p
              v-if="!files.invalidFiles.rows.length"
              class="cwa:m-0 cwa:text-control cwa:text-fg-muted"
            >
              No invalid files.
            </p>
            <ul
              v-else
              class="cwa:m-0 cwa:list-none cwa:p-0"
            >
              <OrphanRow
                v-for="row of files.invalidFiles.rows"
                :key="row.key"
                data-testid="orphaned-file-row"
              >
                <CopyableText :text="row.iri">
                  <NuxtLink
                    :to="getInternalResourceLink(row.iri)"
                    :class="linkClasses"
                  >
                    {{ row.iri }}
                  </NuxtLink>
                </CopyableText>
                <span class="cwa:text-helper cwa:text-fg-muted">{{ row.field }}</span>
                <CopyableText
                  :text="row.path"
                  kind="path"
                  class="cwa:break-all cwa:font-mono cwa:text-helper cwa:text-fg-secondary"
                />
                <span class="cwa:text-helper cwa:text-fg-muted">{{ row.adapter }}</span>
                <ul class="cwa:m-0 cwa:mt-1 cwa:list-disc cwa:ps-5 cwa:text-helper cwa:text-danger-fg">
                  <li
                    v-for="(violation, index) of row.violations"
                    :key="index"
                  >
                    {{ violation }}
                  </li>
                </ul>
              </OrphanRow>
            </ul>
          </CwaUiFormSection>
        </div>
      </template>
    </section>
    <p
      role="status"
      aria-live="polite"
      class="cwa:sr-only"
      data-testid="orphaned-announcer"
    >
      {{ message }}
    </p>
  </ListContainer>
</template>

<script lang="ts" setup>
import { computed, onMounted, provide, watch } from 'vue'
import ListHeading from '#cwa/templates/components/core/admin/ListHeading.vue'
import ListContainer from '#cwa/templates/components/core/admin/ListContainer.vue'
import OrphanRow from '#cwa/templates/components/core/admin/OrphanRow.vue'
import OrphanRowView from '#cwa/templates/components/core/admin/OrphanRowView.vue'
import CopyableText from '#cwa/templates/components/core/admin/CopyableText.vue'
import CwaUiAlert from '#cwa/templates/components/ui/Alert.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import CwaUiFormSection from '#cwa/templates/components/ui/FormSection.vue'
import Spinner from '#cwa/templates/components/ui/Spinner.vue'
import { createAnnouncer } from '#cwa/templates/components/core/ui/field-context'
import { announceKey } from '#cwa/templates/components/core/ui/field-keys'
import { formatDateTime } from '#cwa/resources/date-time-input'
import { useOrphanedResources } from '#cwa-layer/_composables/useOrphanedResources'
import { useOrphanedFiles } from '#cwa-layer/_composables/useOrphanedFiles'
import { definePageMeta, useCwaResourceRoute, useHead } from '#imports'

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

const { getInternalResourceLink } = useCwaResourceRoute()

const busyReason = 'Wait for the scan or delete to finish.'

const linkClasses = 'cwa:break-all cwa:font-mono cwa:text-control cwa:text-fg cwa:underline cwa:underline-offset-2 cwa:outline-1 cwa:outline-transparent cwa:hover:text-accent-fg cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg'

const { message, announce } = createAnnouncer()

provide(announceKey, announce)

const announcements = computed(() => [
  loadError.value || scanError.value || deleteError.value,
  scanPending.value ? 'The scan has been requested but has not finished yet.' : undefined,
  deleteOutcome.value?.summary,
  files.loadError.value || files.scanError.value || files.deleteError.value,
  files.scanPending.value ? 'The file scan has been requested but has not finished yet.' : undefined,
  files.deleteOutcome.value ? `Files: ${files.deleteOutcome.value.summary}` : undefined,
])

watch(announcements, (now, before) => {
  const changed = now.filter((text, index) => text && text !== before?.[index])
  changed.length && announce(changed.join(' '))
})

onMounted(() => {
  loadReport()
  files.loadReport()
})
</script>
