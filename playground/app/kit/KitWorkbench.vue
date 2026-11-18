<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw, useTemplateRef, watch } from 'vue'
import { useRoute } from '#imports'
import KitToolbar from './KitToolbar.vue'
import { KIT_FRAME_MESSAGE, KIT_SCROLL_MESSAGE, startKitWorkbench, useKitWorkbench } from './workbench-state'

const route = useRoute()
const framed = route.query.frame === '1'
const { settings, ready } = useKitWorkbench()

const root = useTemplateRef<HTMLElement>('root')
const iframe = useTemplateRef<HTMLIFrameElement>('iframe')
const frameBox = useTemplateRef<HTMLElement>('frameBox')
const sections = ref<{ id: string, label: string }[]>([])
const frameWidth = ref<number>()
const toolbarHeight = ref(0)
const staged = computed(() => ready.value && settings.width !== 'full')

let stop: (() => void) | undefined
let sectionObserver: MutationObserver | undefined
let frameObserver: ResizeObserver | undefined
let toolbarObserver: ResizeObserver | undefined

function demoDocument() {
  return staged.value ? iframe.value?.contentDocument ?? undefined : document
}

function readSections() {
  const doc = demoDocument()
  sections.value = Array.from(doc?.querySelectorAll<HTMLElement>('main section[aria-labelledby]') ?? []).flatMap((section) => {
    const id = section.getAttribute('aria-labelledby')!
    const label = doc?.getElementById(id)?.textContent?.trim()
    return label ? [{ id, label }] : []
  })
}

function watchSections() {
  sectionObserver?.disconnect()
  const main = demoDocument()?.querySelector('main')
  if (main) {
    sectionObserver = new MutationObserver(readSections)
    sectionObserver.observe(main.parentElement ?? main, { childList: true, subtree: true })
  }
  readSections()
}

function postSettings() {
  iframe.value?.contentWindow?.postMessage({ type: KIT_FRAME_MESSAGE, settings: { ...toRaw(settings) } }, window.location.origin)
}

function onFrameLoad() {
  postSettings()
  watchSections()
}

function jump(id: string) {
  if (staged.value) {
    iframe.value?.contentWindow?.postMessage({ type: KIT_SCROLL_MESSAGE, id }, window.location.origin)
    return
  }
  const target = document.getElementById(id)
  if (target) {
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - toolbarHeight.value - 8 })
  }
}

onMounted(() => {
  stop = startKitWorkbench(framed)
  if (framed) {
    return
  }
  nextTick(watchSections)
  if (root.value) {
    toolbarObserver = new ResizeObserver(() => {
      toolbarHeight.value = Math.round(root.value?.getBoundingClientRect().height ?? 0)
    })
    toolbarObserver.observe(root.value)
  }
})

onBeforeUnmount(() => {
  stop?.()
  sectionObserver?.disconnect()
  frameObserver?.disconnect()
  toolbarObserver?.disconnect()
  document.documentElement.style.removeProperty('overflow')
})

watch(settings, postSettings, { deep: true })

watch(staged, (value) => {
  if (value) {
    window.scrollTo({ top: 0 })
    document.documentElement.style.overflow = 'hidden'
  }
  else {
    document.documentElement.style.removeProperty('overflow')
  }
  nextTick(watchSections)
})

watch(frameBox, (box) => {
  frameObserver?.disconnect()
  frameWidth.value = undefined
  if (box) {
    frameObserver = new ResizeObserver(() => {
      frameWidth.value = Math.round(box.getBoundingClientRect().width)
    })
    frameObserver.observe(box)
  }
})
</script>

<template>
  <div
    v-if="!framed"
    ref="root"
    class="kit-workbench"
  >
    <KitToolbar
      :sections="sections"
      :frame-width="staged ? frameWidth : undefined"
      @jump="jump"
    />
    <div
      v-if="staged"
      class="kit-workbench-stage"
      :style="{ top: `${toolbarHeight}px` }"
      data-testid="kit-frame-stage"
    >
      <div
        ref="frameBox"
        :key="settings.width"
        class="kit-workbench-frame"
        :style="{ width: `${settings.width}px` }"
      >
        <iframe
          ref="iframe"
          src="/kit?frame=1"
          title="Kit demos"
          data-testid="kit-frame"
          @load="onFrameLoad"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.kit-workbench {
  position: sticky;
  top: 0;
  z-index: 740;
  margin: -1.5rem -1rem 1.5rem;
}

@media (min-width: 640px) {
  .kit-workbench {
    margin: -2rem -2.5rem 1.5rem;
  }
}

.kit-workbench-stage {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  overflow: auto;
  padding: 1rem;
  background: var(--cwa-color-surface-raised);
}

.kit-workbench-frame {
  display: flex;
  flex: none;
  min-width: 320px;
  margin-inline: auto;
  resize: horizontal;
  overflow: hidden;
  box-shadow: 0 0 0 1px var(--cwa-color-line);
}

.kit-workbench-frame iframe {
  flex: 1;
  border: 0;
  background: var(--cwa-color-surface);
}
</style>
