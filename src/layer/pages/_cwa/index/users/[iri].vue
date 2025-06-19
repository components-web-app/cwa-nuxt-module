<template>
  <ResourceModal
    v-if="localResourceData && resource"
    v-model="localResourceData.username"
    title-placeholder="No Username"
    :is-loading="isLoading"
    @close="$emit('close')"
    @save="saveTitle"
  >
    <ResourceModalTabs :tabs="tabs">
      <template #details>
        <div class="cwa:flex cwa:flex-col cwa:gap-y-2">
          <div>
            <CwaUiFormToggle
              v-model="localResourceData.enabled"
              label="User Enabled"
            />
          </div>
          <div>
            <ModalInput
              v-model="emailAddress"
              label="Email"
              type="email"
            />
          </div>
          <div
            v-if="!!resource.newEmailAddress"
            class="cwa:mb-4 cwa:text-sm"
          >
            <p>You have requested to change the email address to <span class="cwa:font-bold">{{ resource.newEmailAddress }}</span></p>
            <TextButton
              :disabled="requestingEmail"
              @click="resendVerifyEmail(resource.username, 'new')"
            >
              <span class="cwa:group-disabled:opacity-50">Resend email verification</span>
              <span
                class="cwa:transition-opacity"
                :class="{ 'cwa:opacity-0': !showSpinnerTick }"
              >
                <SpinnerTick
                  :is-loading="requestingEmail"
                  :is-pending="!!requestError"
                  size="cwa:size-4"
                />
              </span>
            </TextButton>
          </div>
          <div v-else-if="localResourceData.emailAddressVerified === false">
            <p>Email not verified.</p>
            <TextButton
              :disabled="requestingEmail"
              @click="resendVerifyEmail(resource.username, 'current')"
            >
              <span class="cwa:group-disabled:opacity-50">Resend email verification</span>
              <span
                class="cwa:transition-opacity"
                :class="{ 'cwa:opacity-0': !showSpinnerTick }"
              >
                <SpinnerTick
                  :is-loading="requestingEmail"
                  :is-pending="!!requestError"
                  size="cwa:size-4"
                />
              </span>
            </TextButton>
          </div>
          <div>
            <ModalSelect
              v-model="selectRole"
              label="Role"
              :options="roleOptions"
            />
          </div>
          <template v-if="isAdding">
            <div>
              <ModalInput
                v-model="localResourceData.plainPassword"
                label="Password"
                type="password"
                placeholder="***"
                autocomplete="new-password"
              />
            </div>
            <div>
              <ModalInput
                v-model="localResourceData.repeatPassword"
                label="Repeat Password"
                type="password"
                placeholder="***"
                autocomplete="new-password"
              />
            </div>
          </template>
          <div class="cwa:flex cwa:justify-end cwa:pt-2 cwa:gap-x-2">
            <div>
              <CwaUiFormButton
                color="dark"
                :disabled="isUpdating"
                @click="saveResource(!isAdding)"
              >
                {{ isAdding ? 'Add Now' : 'Save & Close' }}
              </CwaUiFormButton>
            </div>
            <div>
              <CwaUiFormButton
                color="blue"
                :disabled="isUpdating"
                @click="() => saveResource(isAdding)"
              >
                {{ isAdding ? 'Add & Close' : 'Save' }}
              </CwaUiFormButton>
            </div>
          </div>
        </div>
      </template>
      <template #password>
        <div class="cwa:flex cwa:flex-col cwa:gap-y-2">
          <div>
            <ModalInput
              v-model="localResourceData.plainPassword"
              label="New Password"
              type="password"
              placeholder="***"
              autocomplete="new-password"
            />
          </div>
          <div>
            <ModalInput
              v-model="localResourceData.repeatPassword"
              label="Repeat Password"
              type="password"
              placeholder="***"
              autocomplete="new-password"
            />
          </div>
          <div class="cwa:flex cwa:justify-end cwa:pt-2 cwa:gap-x-2">
            <div v-if="!isAdding">
              <CwaUiFormButton
                color="dark"
                :disabled="isUpdating"
                @click="saveResource(true)"
              >
                Save & Close
              </CwaUiFormButton>
            </div>
            <div>
              <CwaUiFormButton
                color="blue"
                :disabled="isUpdating"
                @click="() => saveResource(false)"
              >
                Save
              </CwaUiFormButton>
            </div>
          </div>
        </div>
      </template>
      <template #info>
        <div class="cwa:flex cwa:flex-col cwa:gap-y-2">
          <div>
            <ModalInfo
              label="Created"
              :content="formatDate(localResourceData.createdAt)"
            />
          </div>
          <div>
            <ModalInfo
              label="Updated"
              :content="formatDate(localResourceData.updatedAt)"
            />
          </div>
          <div>
            <ModalInfo
              label="ID"
              :content="localResourceData['@id']"
            />
          </div>
          <div class="cwa:flex cwa:justify-start cwa:pt-6">
            <div>
              <CwaUiFormButton
                :disabled="isUpdating"
                @click="handleDeleteClick"
              >
                Delete
              </CwaUiFormButton>
            </div>
          </div>
        </div>
      </template>
    </ResourceModalTabs>
  </ResourceModal>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useItemPage } from '../composables/useItemPage'
import SpinnerTick from '#cwa/runtime/templates/components/utils/SpinnerTick.vue'
import { useResendVerifyEmail } from '#cwa/runtime/composables/useResendVerifyEmail'
import TextButton from '#cwa/layer/_components/TextButton.vue'
import { definePageMeta, type SelectOption } from '#imports'
import ResourceModal from '#cwa/runtime/templates/components/core/admin/ResourceModal.vue'
import ResourceModalTabs, { type ResourceModalTab } from '#cwa/runtime/templates/components/core/admin/ResourceModalTabs.vue'
import ModalInfo from '#cwa/runtime/templates/components/core/admin/form/ModalInfo.vue'
import ModalSelect from '#cwa/runtime/templates/components/core/admin/form/ModalSelect.vue'
import ModalInput from '#cwa/runtime/templates/components/core/admin/form/ModalInput.vue'

const emit = defineEmits<{
  close: []
  reload: []
}>()

const emailAddress = computed({
  get() {
    return localResourceData.value?.newEmailAddress || localResourceData.value?.emailAddress
  },
  set(newEmailAddress: string) {
    if (!localResourceData.value) {
      return
    }
    if (isAdding.value) {
      localResourceData.value.emailAddress = newEmailAddress
    }
    else {
      localResourceData.value.newEmailAddress = newEmailAddress
    }
  },
})

const { isAdding, isLoading, isUpdating, localResourceData, formatDate, deleteResource, saveResource, saveTitle, resource } = useItemPage({
  createEndpoint: '/users',
  emit,
  resourceType: 'User',
  defaultResource: {
    enabled: true,
    roles: ['ROLE_USER'],
  },
  validate: (data) => {
    if (data?.plainPassword) {
      if (data.plainPassword !== data.repeatPassword) {
        return 'The passwords entered do not match'
      }
    }
    return true
  },
})

const roleOptions: SelectOption[] = [
  {
    label: 'User',
    value: 'ROLE_USER',
  },
  {
    label: 'Admin',
    value: 'ROLE_ADMIN',
  },
  {
    label: 'Super Admin',
    value: 'ROLE_SUPER_ADMIN',
  },
]

const tabs = computed<ResourceModalTab[]>(() => {
  const t: ResourceModalTab[] = [
    {
      label: 'Details',
      id: 'details',
    },
  ]
  if (!isAdding.value) {
    t.push({
      label: 'Password',
      id: 'password',
    })
    t.push({
      label: 'Info',
      id: 'info',
    })
  }
  return t
})

function handleDeleteClick() {
  deleteResource()
}

const {
  resendVerifyEmail,
  submitting: requestingEmail,
  error: requestError,
} = useResendVerifyEmail()

const debouncedHideSpinner = useDebounceFn(() => {
  if (!requestingEmail.value) {
    showSpinnerTick.value = false
  }
}, 5000)

const showSpinnerTick = ref(false)
watch(requestingEmail, (isRequesting) => {
  if (isRequesting) {
    showSpinnerTick.value = true
    return
  }
  debouncedHideSpinner()
})

function getHighestRole() {
  const resourceRoles = localResourceData.value?.roles
  if (!Array.isArray(resourceRoles)) {
    return
  }
  const reversed = roleOptions.slice().reverse()
  for (const roleOption of reversed) {
    if (resourceRoles.includes(roleOption.value)) {
      return roleOption.value
    }
  }
}
const selectRole = ref(getHighestRole())

watch(localResourceData, () => {
  selectRole.value = getHighestRole()
})
watch(selectRole, (newRole) => {
  if (!localResourceData.value) {
    return
  }
  localResourceData.value.roles = [newRole]
})

definePageMeta({
  name: '_cwa-users-user-iri',
})
</script>
