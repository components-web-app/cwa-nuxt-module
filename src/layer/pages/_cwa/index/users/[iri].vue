<template>
  <CwaUiDialog
    v-if="localResourceData"
    :title="dialogTitle"
    :tabs="tabs"
    :form="form"
    :loading="isLoading"
    noun="user"
    :create-noun="isAdding ? 'user' : undefined"
    data-testid="user-dialog"
    @close="$emit('close')"
    @save="save()"
  >
    <template #details>
      <CwaUiFormSection>
        <CwaUiInput
          field="username"
          label="Username"
          autocomplete="off"
        />
        <CwaUiToggle
          field="enabled"
          label="User enabled"
          description="A disabled user can't sign in."
        />
      </CwaUiFormSection>
      <CwaUiFormSection title="Email">
        <CwaUiInput
          :model="emailModel"
          label="Email"
          type="email"
          width="full"
          autocomplete="off"
        />
        <CwaUiInput
          v-if="isChangingEmail"
          :model="oldPasswordModel"
          label="Your current password"
          description="Changing the email needs your own password."
          type="password"
          autocomplete="current-password"
        />
        <CwaUiAlert
          v-if="resource?.newEmailAddress"
          tone="info"
          :title="`Waiting for ${resource.newEmailAddress} to be confirmed`"
          data-testid="user-pending-email"
        >
          <p class="cwa:m-0">
            The email stays {{ resource.emailAddress }} until the link sent to the new address is opened.
          </p>
          <template #actions>
            <CwaUiButton
              :label="resendLabel"
              :loading="requestingEmail"
              :disabled="retryIn > 0"
              :disabled-reason="retryIn > 0 ? resendWait : undefined"
              data-resend-email
              @click="resendVerifyEmail(resource.username, 'new')"
            />
            <CwaUiButton
              tone="danger"
              label="Cancel change"
              :loading="cancellingEmailChange"
              data-cancel-email-change
              @click="cancelEmailChange"
            />
          </template>
        </CwaUiAlert>
        <CwaUiAlert
          v-else-if="!isAdding && resource?.emailAddressVerified === false"
          tone="warning"
          title="Email not verified"
          data-testid="user-unverified-email"
        >
          <template #actions>
            <CwaUiButton
              :label="resendLabel"
              :loading="requestingEmail"
              :disabled="retryIn > 0"
              :disabled-reason="retryIn > 0 ? resendWait : undefined"
              data-resend-email
              @click="resendVerifyEmail(resource!.username, 'current')"
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
      <CwaUiFormSection title="Access">
        <CwaUiSelect
          :model="roleModel"
          label="Role"
          :options="roleOptions"
          :disabled="isSelf"
          disabled-reason="You can't change your own role."
        />
      </CwaUiFormSection>
      <CwaUiFormSection
        v-if="isAdding"
        title="Password"
        :columns="2"
      >
        <CwaUiInput
          field="plainPassword"
          label="Password"
          type="password"
          autocomplete="new-password"
        />
        <CwaUiInput
          field="repeatPassword"
          label="Repeat password"
          type="password"
          autocomplete="new-password"
        />
      </CwaUiFormSection>
    </template>
    <template #password>
      <CwaUiFormSection
        description="Sets a new password for this user. Leave it empty to keep theirs."
        :columns="2"
      >
        <CwaUiInput
          field="plainPassword"
          label="New password"
          type="password"
          autocomplete="new-password"
        />
        <CwaUiInput
          field="repeatPassword"
          label="Repeat password"
          type="password"
          autocomplete="new-password"
        />
      </CwaUiFormSection>
    </template>
    <template #info>
      <CwaUiFormSection>
        <dl class="cwa:m-0">
          <dt class="cwa:text-label cwa:text-fg">
            ID
          </dt>
          <dd
            class="cwa:m-0 cwa:mt-1.5 cwa:break-all cwa:font-mono cwa:text-control cwa:text-fg-secondary"
            data-testid="user-id"
          >
            {{ localResourceData['@id'] }}
          </dd>
        </dl>
      </CwaUiFormSection>
      <CwaUiFormSection
        title="History"
        :columns="2"
      >
        <dl
          v-for="entry in history"
          :key="entry.label"
          class="cwa:m-0"
        >
          <dt class="cwa:text-label cwa:text-fg">
            {{ entry.label }}
          </dt>
          <dd class="cwa:m-0 cwa:mt-1.5 cwa:text-control cwa:text-fg-secondary">
            {{ entry.value }}
          </dd>
        </dl>
      </CwaUiFormSection>
      <CwaUiFormSection
        title="Delete this user"
        description="They can no longer sign in, and their account is removed."
        data-testid="user-delete-section"
      >
        <div>
          <CwaUiButton
            tone="danger"
            label="Delete user"
            :loading="isUpdating"
            :disabled="isSelf"
            disabled-reason="You can't delete your own account."
            data-testid="user-delete"
            @click="handleDeleteClick"
          />
        </div>
      </CwaUiFormSection>
    </template>
  </CwaUiDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useItemPage } from '#cwa-layer/_composables/useItemPage'
import { useResendVerifyEmail } from '#cwa/composables/useResendVerifyEmail'
import { useCwa } from '#cwa/composables/cwa'
import { useCwaConfirm } from '#cwa/composables/cwa-confirm'
import { formatCountdown } from '#cwa/api/retry-after'
import { definePageMeta } from '#imports'
import CwaUiDialog from '#cwa/templates/components/ui/Dialog.vue'
import CwaUiFormSection from '#cwa/templates/components/ui/FormSection.vue'
import CwaUiInput from '#cwa/templates/components/ui/Input.vue'
import CwaUiToggle from '#cwa/templates/components/ui/Toggle.vue'
import CwaUiSelect from '#cwa/templates/components/ui/Select.vue'
import CwaUiAlert from '#cwa/templates/components/ui/Alert.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import StateGlyph from '#cwa/templates/components/core/ui/StateGlyph.vue'
import type { MenuEntry } from '#cwa/templates/components/core/ui/menu-entries'
import type { DialogTab } from '#cwa/templates/components/core/ui/dialog-form'
import type { ResourceModelField } from '#cwa/resources/model-editors'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'

definePageMeta({
  name: '_cwa-users-user-iri',
})

const emit = defineEmits<{
  close: []
  reload: []
}>()

const $cwa = useCwa()
const confirm = useCwaConfirm()

const IDLE: CwaFieldState = { status: 'idle', waiting: false, slow: false }

const { isAdding, isLoading, isUpdating, localResourceData, formatDate, deleteResource, saveResource, resource, form } = useItemPage({
  createEndpoint: '/users',
  emit,
  resourceType: 'User',
  defaultResource: {
    enabled: true,
    roles: ['ROLE_USER'],
  },
  excludeFields: ['repeatPassword'],
  validate: (data) => {
    if (data?.plainPassword && data.plainPassword !== data.repeatPassword) {
      return { repeatPassword: 'The passwords don\'t match.' }
    }
    return undefined
  },
  dismissStoredErrors: true,
})

const isSelf = computed(() => !isAdding.value && !!$cwa.auth.user?.['@id'] && $cwa.auth.user['@id'] === localResourceData.value?.['@id'])

const emailField = computed(() => isAdding.value ? 'emailAddress' : 'newEmailAddress')

const emailModel = {
  ...form.model<string>('newEmailAddress'),
  get field() {
    return emailField.value
  },
  state: computed(() => form.model<string>(emailField.value).state?.value),
  model: computed({
    get: () => localResourceData.value?.newEmailAddress || localResourceData.value?.emailAddress,
    set: (value: string | null | undefined) => {
      const local = localResourceData.value
      if (local) {
        local[emailField.value] = value
      }
    },
  }),
} as unknown as ResourceModelField<string>

const isChangingEmail = computed(() => {
  const newEmailAddress = localResourceData.value?.newEmailAddress
  return !isAdding.value && !!newEmailAddress && newEmailAddress !== resource.value?.newEmailAddress
})

const oldPassword = ref<string>()
const rejectedPassword = ref<string>()

watch(() => form.fieldErrors.oldPassword, (error) => {
  rejectedPassword.value = error ? (oldPassword.value ?? '') : undefined
})

watch(isChangingEmail, (changing) => {
  if (!changing) {
    oldPassword.value = undefined
  }
})

const oldPasswordModel = {
  ...form.model<string>('oldPassword'),
  model: oldPassword,
  state: computed<CwaFieldState>(() => {
    const message = form.fieldErrors.oldPassword
    if (!message || rejectedPassword.value !== (oldPassword.value ?? '')) {
      return IDLE
    }
    return { status: 'error', waiting: false, slow: false, error: { kind: 'violation', message } }
  }),
} as unknown as ResourceModelField<string>

async function save() {
  const savedResource = await saveResource(false, isChangingEmail.value && oldPassword.value ? { oldPassword: oldPassword.value } : undefined)
  if (savedResource) {
    oldPassword.value = undefined
    if (localResourceData.value && !isAdding.value) {
      delete localResourceData.value.repeatPassword
    }
  }
  return savedResource
}

const roleOptions: MenuEntry[] = [
  { label: 'User', value: 'ROLE_USER' },
  { label: 'Admin', value: 'ROLE_ADMIN' },
  { label: 'Super Admin', value: 'ROLE_SUPER_ADMIN' },
]

function highestRole(roles: unknown) {
  if (!Array.isArray(roles)) {
    return undefined
  }
  return [...roleOptions].reverse().find(option => 'value' in option && roles.includes(option.value))
}

const roleModel = {
  ...form.model<string[]>('roles'),
  model: computed({
    get: () => {
      const option = highestRole(localResourceData.value?.roles)
      return option && 'value' in option ? option.value : undefined
    },
    set: (role: string | null | undefined) => {
      if (localResourceData.value && role) {
        localResourceData.value.roles = [role]
      }
    },
  }),
} as unknown as ResourceModelField<string>

const username = computed(() => (resource.value?.username as string | undefined) || '')

const dialogTitle = computed(() => isAdding.value ? 'New user' : (username.value || 'No username'))

const tabs = computed<DialogTab[]>(() => isAdding.value
  ? [{ label: 'Details', key: 'details' }]
  : [{ label: 'Details', key: 'details' }, { label: 'Password', key: 'password' }, { label: 'Info', key: 'info' }])

const history = computed(() => [
  { label: 'Created', value: localResourceData.value?.createdAt ? formatDate(localResourceData.value.createdAt) : '—' },
  { label: 'Updated', value: localResourceData.value?.updatedAt ? formatDate(localResourceData.value.updatedAt) : '—' },
])

async function handleDeleteClick() {
  const email = (resource.value?.emailAddress as string | undefined) || ''
  const confirmed = await confirm({
    title: `Delete “${username.value || email || dialogTitle.value}”?`,
    lines: [
      ...(form.unsavedFields.length ? [{ text: `Your ${form.unsavedFields.length} unsaved ${form.unsavedFields.length === 1 ? 'change is' : 'changes are'} discarded too.` }] : []),
      { text: 'This can\'t be undone.' },
    ],
    keep: 'Don\'t delete',
    go: 'Delete user',
    typed: email.trim() ? { noun: 'email', value: email } : undefined,
  })
  if (!confirmed) {
    return
  }
  return deleteResource(undefined, () => form.discard(), true)
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

const cancellingEmailChange = ref(false)

async function cancelEmailChange() {
  const iri = resource.value?.['@id']
  if (!iri) {
    return
  }
  cancellingEmailChange.value = true
  try {
    await $cwa.resourcesManager.updateResource({
      endpoint: iri,
      data: { newEmailAddress: null },
    })
  }
  finally {
    cancellingEmailChange.value = false
  }
}
</script>
