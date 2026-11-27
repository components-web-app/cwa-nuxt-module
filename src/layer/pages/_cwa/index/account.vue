<template>
  <ListHeading title="My account" />
  <div
    class="cwa:mx-auto cwa:w-full cwa:max-w-6xl cwa:px-4 cwa:pb-16 cwa:sm:px-8"
    data-testid="account-page"
  >
    <div
      v-if="loading && !account"
      class="cwa:grid cwa:min-h-40 cwa:max-w-[40rem] cwa:place-items-center"
      aria-busy="true"
      data-testid="account-loading"
    >
      <Spinner size="md" />
      <span class="cwa:sr-only">Loading your account</span>
    </div>
    <CwaUiAlert
      v-else-if="loadFailed || !account"
      tone="danger"
      title="Your account couldn't be loaded."
      data-testid="account-load-error"
      class="cwa:max-w-[40rem]"
    >
      <p class="cwa:m-0">
        Check your connection, then try again.
      </p>
      <template #actions>
        <CwaUiButton
          label="Try again"
          data-testid="account-retry"
          @click="reload"
        />
      </template>
    </CwaUiAlert>
    <div
      v-else
      class="cwa:max-w-[40rem]"
    >
      <CwaUiFormSection
        title="Email"
        :description="`Your email is ${account.emailAddress}.`"
      >
        <form
          class="cwa:grid cwa:grid-cols-1 cwa:gap-y-stack"
          data-testid="account-email-form"
          @submit.prevent="submitEmail"
        >
          <CwaUiInput
            v-model="newEmail"
            label="New email"
            type="email"
            width="full"
            autocomplete="email"
            :invalid="emailErrors.newEmailAddress"
          />
          <CwaReveal :when="!!newEmail">
            <CwaUiInput
              v-model="emailPassword"
              label="Your current password"
              info="Changing your email needs your password."
              type="password"
              autocomplete="current-password"
              :invalid="emailPasswordError"
            />
          </CwaReveal>
          <div>
            <CwaUiButton
              type="submit"
              label="Change email"
              :loading="submittingEmail && !cancelling"
              :disabled="!newEmail || !emailPassword"
              :disabled-reason="!newEmail ? 'Enter the new email first.' : 'Enter your current password first.'"
              data-testid="account-change-email"
            />
          </div>
        </form>
        <CwaUiAlert
          v-if="pending"
          tone="info"
          :title="`Waiting for ${pending} to be confirmed`"
          data-testid="account-pending-email"
        >
          <p class="cwa:m-0">
            Your email stays {{ account.emailAddress }} until the link sent to the new address is opened.
          </p>
          <template #actions>
            <CwaUiButton
              :label="resendLabel"
              :loading="requestingEmail"
              :disabled="retryIn > 0"
              :disabled-reason="retryIn > 0 ? resendWait : undefined"
              data-resend-email
              @click="resendVerifyEmail(account.username, 'new')"
            />
            <CwaUiButton
              tone="danger"
              label="Cancel change"
              :loading="cancelling"
              data-cancel-email-change
              @click="cancelEmailChange"
            />
          </template>
        </CwaUiAlert>
        <CwaUiAlert
          v-else-if="account.emailAddressVerified === false"
          tone="warning"
          title="Email not verified"
          data-testid="account-unverified-email"
        >
          <template #actions>
            <CwaUiButton
              :label="resendLabel"
              :loading="requestingEmail"
              :disabled="retryIn > 0"
              :disabled-reason="retryIn > 0 ? resendWait : undefined"
              data-resend-email
              @click="resendVerifyEmail(account.username, 'current')"
            />
          </template>
        </CwaUiAlert>
        <p
          v-if="requestError"
          role="status"
          data-email-request-error
          class="cwa:m-0 cwa:flex cwa:items-start cwa:gap-1.5 cwa:text-helper cwa:text-danger-fg"
        >
          <StateGlyph
            kind="error"
            class="cwa:mt-0.5"
          />
          <span>{{ requestError }}</span>
        </p>
        <p
          v-else-if="requestSent"
          role="status"
          data-email-request-sent
          class="cwa:m-0 cwa:flex cwa:items-start cwa:gap-1.5 cwa:text-helper cwa:text-fg-muted"
        >
          <StateGlyph
            kind="saved"
            class="cwa:mt-0.5"
          />
          <span>Verification email sent.</span>
        </p>
      </CwaUiFormSection>
      <CwaUiFormSection title="Password">
        <form
          class="cwa:grid cwa:grid-cols-1 cwa:gap-y-stack"
          data-testid="account-password-form"
          @submit.prevent="submitPassword"
        >
          <CwaUiInput
            v-model="oldPassword"
            label="Current password"
            type="password"
            autocomplete="current-password"
            :invalid="oldPasswordError"
          />
          <CwaUiInput
            v-model="password"
            label="New password"
            type="password"
            revealable
            autocomplete="new-password"
            :invalid="passwordErrors.password"
          />
          <CwaUiInput
            v-model="repeatPassword"
            label="Repeat new password"
            type="password"
            revealable
            autocomplete="new-password"
            :invalid="passwordErrors.repeatPassword"
          />
          <div>
            <CwaUiButton
              type="submit"
              label="Change password"
              :loading="submittingPassword"
              :disabled="!oldPassword || !password || !repeatPassword"
              disabled-reason="Fill in all three passwords first."
              data-testid="account-change-password"
            />
          </div>
          <p
            v-if="saved"
            role="status"
            data-password-saved
            class="cwa:m-0 cwa:flex cwa:items-start cwa:gap-1.5 cwa:text-helper cwa:text-fg-muted"
          >
            <StateGlyph
              kind="saved"
              class="cwa:mt-0.5"
            />
            <span>Your password has been changed.</span>
          </p>
        </form>
      </CwaUiFormSection>
      <CwaUiFormSection
        v-if="'adminPreferences' in account"
        title="Admin top bar"
        description="Choose and order the shortcuts in your top bar. Only you see this choice."
      >
        <TopBarSettings
          :model-value="topBar"
          @update:model-value="saveTopBar"
        />
      </CwaUiFormSection>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'
import type { Ref } from 'vue'
import ListHeading from '#cwa/templates/components/core/admin/ListHeading.vue'
import CwaUiFormSection from '#cwa/templates/components/ui/FormSection.vue'
import CwaUiInput from '#cwa/templates/components/ui/Input.vue'
import CwaUiAlert from '#cwa/templates/components/ui/Alert.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import CwaReveal from '#cwa/templates/components/core/ui/Reveal.vue'
import Spinner from '#cwa/templates/components/ui/Spinner.vue'
import StateGlyph from '#cwa/templates/components/core/ui/StateGlyph.vue'
import { formSurfaceKey, sectionHeadingKey } from '#cwa/templates/components/core/ui/field-keys'
import { useCwaAccount } from '#cwa/composables/useCwaAccount'
import { useCwaChangeEmail } from '#cwa/composables/useCwaChangeEmail'
import { useCwaChangePassword } from '#cwa/composables/useCwaChangePassword'
import { useResendVerifyEmail } from '#cwa/composables/useResendVerifyEmail'
import { formatCountdown } from '#cwa/api/retry-after'
import { writeOwnUser } from '#cwa/api/own-user-write'
import { useCwa } from '#cwa/composables/cwa'
import { useCwaToast } from '#cwa/composables/cwa-toast'
import TopBarSettings from '#cwa/templates/components/core/admin/TopBarSettings.vue'
import { definePageMeta, useHead } from '#imports'

definePageMeta({
  name: '_cwa-account',
  pageTransition: false,
})

useHead({
  title: 'My account',
})

provide(formSurfaceKey, { unsaved: () => false, register: () => () => {} })
provide(sectionHeadingKey, 'h2')

const { account, loading, loadFailed, reload } = useCwaAccount()

const $cwa = useCwa()
const toast = useCwaToast()

function savedTopBar() {
  const topBar = account.value?.adminPreferences?.topBar
  return Array.isArray(topBar) ? topBar as string[] : null
}

const topBar = ref<string[] | null>(null)
watch(account, () => {
  topBar.value = savedTopBar()
}, { immediate: true })

async function saveTopBar(next: string[] | null) {
  topBar.value = next
  const adminPreferences = next ? { ...account.value?.adminPreferences, topBar: next } : null
  const { user, failure } = await writeOwnUser($cwa, { adminPreferences }, ['adminPreferences'])
  if (!user) {
    topBar.value = savedTopBar()
    toast.show({ tone: 'error', title: 'Your top bar wasn\'t saved.', description: failure })
    return
  }
  account.value = { ...account.value!, adminPreferences: user.adminPreferences }
  await $cwa.auth.refreshUser()
}

const {
  newEmail,
  oldPassword: emailPassword,
  submit: submitEmail,
  cancel,
  pending,
  submitting: submittingEmail,
  fieldErrors: emailErrors,
} = useCwaChangeEmail()

const {
  oldPassword,
  password,
  repeatPassword,
  submit: submitPassword,
  submitting: submittingPassword,
  fieldErrors: passwordErrors,
  saved,
} = useCwaChangePassword()

function rejectedWhileUnchanged(errors: Ref<Record<string, string>>, typed: Ref<string>) {
  const rejected = ref<string>()
  watch(errors, (next) => {
    rejected.value = next.oldPassword ? typed.value : undefined
  })
  return computed(() => rejected.value !== undefined && rejected.value === typed.value ? errors.value.oldPassword : undefined)
}

const emailPasswordError = rejectedWhileUnchanged(emailErrors, emailPassword)
const oldPasswordError = rejectedWhileUnchanged(passwordErrors, oldPassword)

const cancelling = ref(false)

async function cancelEmailChange() {
  cancelling.value = true
  try {
    await cancel()
  }
  finally {
    cancelling.value = false
  }
}

const {
  resendVerifyEmail,
  submitting: requestingEmail,
  error: requestError,
  success: requestSent,
  retryIn,
} = useResendVerifyEmail()

const resendLabel = computed(() => retryIn.value > 0 ? `Resend verification email (${formatCountdown(retryIn.value)})` : 'Resend verification email')
const resendWait = computed(() => `You can send another in ${formatCountdown(retryIn.value)}.`)
</script>
