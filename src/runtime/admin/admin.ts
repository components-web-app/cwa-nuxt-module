import { storeToRefs } from 'pinia'
import { AdminStore } from '#cwa/runtime/storage/stores/admin/admin-store'

export default class Admin {
  // eslint-disable-next-line no-useless-constructor
  public constructor (private adminStoreDefinition: AdminStore) {
  }

  public setEditing (editing?: boolean) {
    // todo: as we are not just changing a single value, and we have some logic, this should be a store action
    const { isEditing, navigationGuardDisabled } = storeToRefs(this.adminStore)
    isEditing.value = editing || !isEditing.value
    // reset navigation guard when we stop editing
    if (!isEditing.value) {
      navigationGuardDisabled.value = false
    }
  }

  public setNavigationGuardDisabled (disabled: boolean) {
    const { navigationGuardDisabled } = storeToRefs(this.adminStore)
    navigationGuardDisabled.value = disabled
  }

  public get navigationGuardDisabled () {
    return this.adminStore.navigationGuardDisabled
  }

  public get isEditing () {
    return this.adminStore.isEditing
  }

  private get adminStore () {
    return this.adminStoreDefinition.useStore()
  }
}
