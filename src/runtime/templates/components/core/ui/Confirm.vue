<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import {
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui'
import CwaUiButton from '../../ui/Button.vue'
import StateGlyph from './StateGlyph.vue'
import { fieldBox, fieldFill } from './field-looks'
import { typedCanStillMatch, typedMatches } from '#cwa/composables/cwa-confirm'
import type { CwaConfirmLine, CwaConfirmTyped } from '#cwa/composables/cwa-confirm'

const { title, description, lines = [], keep = 'Keep editing', go, tone = 'danger', typed } = defineProps<{
  title: string
  description?: string
  lines?: CwaConfirmLine[]
  keep?: string
  go: string
  tone?: 'danger' | 'accent'
  typed?: CwaConfirmTyped
}>()

const emit = defineEmits<{ confirm: [], cancel: [] }>()

const open = ref(true)
const text = ref('')
const answered = ref(false)
const announcement = ref('')
const fieldId = useId()
const helperId = useId()
const keepButton = useTemplateRef<InstanceType<typeof CwaUiButton>>('keepButton')
const input = useTemplateRef<HTMLInputElement>('input')

const matches = computed(() => !typed || typedMatches(text.value, typed.value))
const invalid = computed(() => !!typed && !matches.value && text.value.trim() !== '' && !typedCanStillMatch(text.value, typed.value))
const helper = computed(() => {
  if (!typed) {
    return undefined
  }
  if (matches.value) {
    return `Matches. ${go} is on.`
  }
  return invalid.value ? `That doesn't match. Type ${typed.value.trim()}.` : `${go} stays off until it matches.`
})

watch(matches, (now) => {
  announcement.value = now ? `Matches. ${go} is on.` : `${go} is off.`
})

function answer(event: 'confirm' | 'cancel') {
  if (answered.value) {
    return
  }
  answered.value = true
  open.value = false
  event === 'confirm' ? emit('confirm') : emit('cancel')
}

function go_() {
  if (matches.value) {
    answer('confirm')
  }
}

function onOpenChange(next: boolean) {
  if (!next) {
    answer('cancel')
  }
}

async function onOpenAutoFocus(event: Event) {
  event.preventDefault()
  await nextTick()
  if (typed) {
    input.value?.focus()
    return
  }
  const element = keepButton.value?.$el as HTMLElement | undefined
  element?.focus()
}

function onEnter() {
  go_()
}
</script>

<template>
  <AlertDialogRoot
    :open="open"
    @update:open="onOpenChange"
  >
    <AlertDialogPortal>
      <AlertDialogOverlay
        data-testid="confirm-scrim"
        class="cwa:fixed cwa:inset-0 cwa:z-context cwa:bg-black/60"
        @click="answer('cancel')"
      />
      <AlertDialogContent
        data-testid="confirm"
        class="cwa:fixed cwa:top-1/2 cwa:left-1/2 cwa:z-context cwa:w-[min(24rem,calc(100vw-2rem))] cwa:-translate-x-1/2 cwa:-translate-y-1/2 cwa:bg-surface-menu cwa:p-5 cwa:text-control cwa:text-fg cwa:shadow-popover cwa:outline-none"
        @open-auto-focus="onOpenAutoFocus"
        @escape-key-down="answer('cancel')"
      >
        <AlertDialogTitle class="cwa:m-0 cwa:text-confirm cwa:text-fg">
          {{ title }}
        </AlertDialogTitle>
        <AlertDialogDescription
          as="div"
          class="cwa:mt-2 cwa:flex cwa:flex-col cwa:gap-2 cwa:text-fg-secondary"
        >
          <p
            v-if="description"
            class="cwa:m-0"
          >
            {{ description }}
          </p>
          <p
            v-for="(line, index) in lines"
            :key="index"
            class="cwa:m-0"
            :class="{ 'cwa:font-semibold cwa:text-fg': line.emphasis === 'strong', 'cwa:text-fg-muted': line.emphasis === 'muted' }"
            data-testid="confirm-line"
          >
            {{ line.text }}
          </p>
        </AlertDialogDescription>
        <div
          v-if="typed"
          class="cwa:mt-4"
        >
          <label
            :for="fieldId"
            class="cwa:block cwa:text-label cwa:text-fg"
          >Type the {{ typed.noun }}, “{{ typed.value.trim() }}”, to confirm</label>
          <div
            class="cwa:mt-1.5"
            :class="[fieldBox, fieldFill(invalid ? 'danger' : undefined, false)]"
          >
            <input
              :id="fieldId"
              ref="input"
              v-model="text"
              type="text"
              autocomplete="off"
              spellcheck="false"
              data-testid="confirm-typed"
              :aria-invalid="invalid ? 'true' : undefined"
              :aria-describedby="helperId"
              class="cwa:h-full cwa:min-w-0 cwa:flex-1 cwa:appearance-none cwa:border-0 cwa:bg-transparent cwa:px-3 cwa:text-control cwa:text-inherit cwa:outline-none cwa:focus:ring-0 cwa:pointer-coarse:text-base"
              @keydown.enter.prevent="onEnter"
            >
          </div>
          <p
            :id="helperId"
            data-testid="confirm-helper"
            class="cwa:mt-2 cwa:mb-0 cwa:flex cwa:items-start cwa:gap-1.5 cwa:text-helper"
            :class="invalid ? 'cwa:text-danger-fg' : 'cwa:text-fg-muted'"
          >
            <StateGlyph
              v-if="invalid"
              kind="error"
              class="cwa:mt-0.5"
            />
            <StateGlyph
              v-else-if="matches"
              kind="saved"
              class="cwa:mt-0.5"
            />
            <span>{{ helper }}</span>
          </p>
          <span
            role="status"
            aria-live="polite"
            class="cwa:sr-only"
            data-testid="confirm-announcer"
          >{{ announcement }}</span>
        </div>
        <div class="cwa:mt-5 cwa:grid cwa:grid-cols-2 cwa:gap-actions cwa:sm:flex cwa:sm:justify-end">
          <CwaUiButton
            ref="keepButton"
            :label="keep"
            data-testid="confirm-keep"
            @click="answer('cancel')"
          />
          <CwaUiButton
            :label="go"
            variant="solid"
            :tone="tone"
            :disabled="!matches"
            :disabled-reason="typed ? `Type the ${typed.noun} in the field above to turn this on.` : undefined"
            data-testid="confirm-go"
            @click="go_"
          />
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
