<script setup lang="ts">
import { computed, inject, ref, useId } from 'vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import CwaUiAlert from '#cwa/templates/components/ui/Alert.vue'
import CwaUiSpinner from '#cwa/templates/components/ui/Spinner.vue'
import CwaUiToggle from '#cwa/templates/components/ui/Toggle.vue'
import CwaUiPlusIcon from '#cwa/templates/components/ui/icon/PlusIcon.vue'
import CopyGlyph from '#cwa/templates/components/core/ui/CopyGlyph.vue'
import RouteStatusBadge from '#cwa/templates/components/core/admin/RouteStatusBadge.vue'
import RouteSubStatus from '#cwa/templates/components/core/admin/RouteSubStatus.vue'
import RouteRecommendation from '#cwa/templates/components/core/admin/RouteRecommendation.vue'
import { useAnnounce } from '#cwa/templates/components/core/ui/field-context'
import { fieldGroupKey } from '#cwa/templates/components/core/ui/field-keys'
import { isRouteGatedByAncestor, routePublicationFromResource, routeReachableAt } from '#cwa/resources/route-publication'
import { formatDateTime } from '#cwa/resources/date-time-input'
import type { CwaResource } from '#cwa/resources/resource-utils'
import type { TempCwaResource } from '#cwa-layer/_composables/useItemPage'

export type RouteSubView = 'route' | 'to' | 'from' | 'kids'

const { resource, isLoading, parentHasNoRoute = false, parentName, forwardToPath, redirectCount = 0, childCount = 0, recommendedPath, recommendedFrom, noun = 'page', status } = defineProps<{
  resource: CwaResource | TempCwaResource | undefined
  isLoading: boolean
  parentHasNoRoute?: boolean
  parentName?: string
  forwardToPath?: string
  redirectCount?: number
  childCount?: number
  recommendedPath?: string
  recommendedFrom?: string
  noun?: string
  status?: string
}>()

const emit = defineEmits<{
  open: [view: RouteSubView, recommended?: boolean]
  openParent: []
}>()

const announce = useAnnounce()
const fieldGroup = inject(fieldGroupKey, undefined)
const publicWithoutRoute = computed(() => !!fieldGroup?.model('isReachableWithoutRoute')?.model.value)
const headingId = useId()
const statusLine = ref<InstanceType<typeof RouteSubStatus> | null>(null)

const path = computed(() => resource?.path as string | undefined)
const publication = computed(() => routePublicationFromResource(resource))
const gated = computed(() => !!path.value && isRouteGatedByAncestor(publication.value))
const gatedAt = computed(() => formatDateTime(routeReachableAt(publication.value)))
const showRecommendation = computed(() => !!recommendedPath && recommendedPath !== path.value)

function count(n: number, one: string, many: string) {
  return n ? `${n} ${n === 1 ? one : many}` : 'None'
}

const rows = computed(() => {
  const list: { view: RouteSubView, label: string, summary: string, arrow?: boolean }[] = []
  if (path.value) {
    list.push(forwardToPath ? { view: 'to', label: 'Redirect to', summary: forwardToPath, arrow: true } : { view: 'to', label: 'Redirect to', summary: 'Off' })
    list.push({ view: 'from', label: 'Redirected from', summary: count(redirectCount, 'old address', 'old addresses') })
  }
  list.push({ view: 'kids', label: 'Child routes', summary: count(childCount, 'route', 'routes') })
  return list
})

async function copyPath() {
  if (!path.value) {
    return
  }
  try {
    await navigator.clipboard.writeText(path.value)
    announce('Path copied')
  }
  catch {
    announce('The path couldn\'t be copied')
  }
}

defineExpose({ statusElement: () => statusLine.value?.element() ?? null })
</script>

<template>
  <div
    data-testid="routes-view"
    :aria-busy="isLoading ? 'true' : undefined"
  >
    <section :aria-labelledby="headingId">
      <h3
        :id="headingId"
        class="cwa:m-0 cwa:mb-section-head cwa:text-section cwa:text-fg-secondary"
      >
        Route
      </h3>
      <RouteSubStatus
        ref="statusLine"
        :text="status"
        class="cwa:mb-stack"
      />
      <div
        v-if="isLoading"
        class="cwa:grid cwa:min-h-20 cwa:place-items-center"
      >
        <CwaUiSpinner size="md" />
      </div>
      <div
        v-else-if="path"
        class="cwa:flex cwa:flex-col cwa:gap-stack"
      >
        <dl class="cwa:m-0">
          <dt class="cwa:text-label cwa:text-fg">
            Path
          </dt>
          <dd class="cwa:m-0 cwa:mt-1 cwa:flex cwa:min-w-0 cwa:flex-wrap cwa:items-center cwa:gap-x-3 cwa:gap-y-1">
            <span class="cwa:flex cwa:min-w-0 cwa:items-center cwa:gap-1">
              <span
                data-testid="routes-path"
                class="cwa:min-w-0 cwa:truncate cwa:font-mono cwa:text-control cwa:text-fg"
              >{{ path }}</span>
              <CwaUiButton
                variant="ghost"
                size="sm"
                icon-only
                :icon="CopyGlyph"
                label="Copy path"
                data-testid="routes-copy"
                @click="copyPath"
              />
            </span>
            <RouteStatusBadge :publication="publication" />
          </dd>
        </dl>
        <RouteRecommendation
          v-if="showRecommendation"
          :path="recommendedPath!"
          :from="recommendedFrom"
          @use="emit('open', 'route', true)"
        />
        <CwaUiAlert
          v-if="gated"
          tone="info"
          title="Inherited from a parent route."
          data-parent-gated
        >
          <template v-if="gatedAt">
            A parent route goes live on {{ gatedAt }}, so visitors can't reach this {{ noun }} before then, whatever its own go-live says.
          </template>
          <template v-else>
            A parent route has no go-live date, so visitors can't reach this {{ noun }} until it has one.
          </template>
        </CwaUiAlert>
        <div>
          <CwaUiButton
            label="Edit route"
            data-testid="routes-edit"
            @click="emit('open', 'route')"
          />
        </div>
      </div>
      <div
        v-else
        class="cwa:flex cwa:flex-col cwa:gap-stack"
      >
        <p
          data-testid="routes-none"
          class="cwa:m-0 cwa:text-control cwa:text-fg-muted"
        >
          <template v-if="publicWithoutRoute">
            No route yet. This {{ noun }} is public without a route: visitors can read it where your app loads it.
          </template>
          <template v-else>
            No route yet. Visitors can't open this {{ noun }} at its own address.<template v-if="!parentHasNoRoute && childCount">
              It is reachable through a nested page.
            </template>
          </template>
        </p>
        <CwaUiToggle
          field="isReachableWithoutRoute"
          label="Public without a route"
          description="For a page your app shows on its own URL, loaded by reference. Visitors can read it without a route. It stays private while a parent page isn't live."
        />
        <CwaUiAlert
          v-if="parentHasNoRoute"
          :title="parentName ? `The parent page, ${parentName}, has no route yet.` : 'The parent page has no route yet.'"
          data-testid="routes-parent-none"
        >
          A route here would start with the parent's path, so add a route to the parent first.
          <template #actions>
            <CwaUiButton
              :label="parentName ? `Open ${parentName}` : 'Open the parent page'"
              data-testid="routes-open-parent"
              @click="emit('openParent')"
            />
          </template>
        </CwaUiAlert>
        <template v-else>
          <div>
            <CwaUiButton
              variant="solid"
              :icon="CwaUiPlusIcon"
              label="Add a route"
              data-testid="routes-add"
              @click="emit('open', 'route')"
            />
          </div>
          <RouteRecommendation
            v-if="recommendedPath"
            :path="recommendedPath"
            :from="recommendedFrom"
            @use="emit('open', 'route', true)"
          />
        </template>
      </div>
    </section>
    <ul
      v-if="!isLoading && !parentHasNoRoute"
      aria-label="More route settings"
      data-testid="routes-rows"
      class="cwa:m-0 cwa:mt-10 cwa:list-none cwa:p-0"
    >
      <li
        v-for="row in rows"
        :key="row.view"
      >
        <button
          type="button"
          :data-nav="row.view"
          class="cwa:flex cwa:min-h-14 cwa:w-full cwa:cursor-pointer cwa:items-center cwa:gap-4 cwa:border-b cwa:border-line cwa:px-4 cwa:py-3 cwa:text-start cwa:text-control cwa:text-fg cwa:outline-1 cwa:outline-transparent cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:hover:bg-button cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg"
          @click="emit('open', row.view)"
        >
          <span class="cwa:shrink-0 cwa:font-semibold">{{ row.label }}</span><span class="cwa:sr-only">: </span>
          <span
            class="cwa:min-w-0 cwa:flex-1 cwa:truncate cwa:text-end cwa:text-fg-muted"
            data-testid="routes-row-summary"
          ><template v-if="row.arrow"><span aria-hidden="true">→ </span><span class="cwa:sr-only">to </span><span class="cwa:font-mono">{{ row.summary }}</span></template><template v-else>{{ row.summary }}</template></span>
          <svg
            viewBox="0 0 6 10"
            aria-hidden="true"
            class="cwa:h-2.5 cwa:w-1.5 cwa:shrink-0 cwa:fill-current cwa:text-fg-muted"
          ><path d="M0 0v10l6-5z" /></svg>
        </button>
      </li>
    </ul>
  </div>
</template>
