import { storeToRefs } from 'pinia'
import { AdminStore } from '#cwa/runtime/storage/stores/admin/admin-store'

export default class Admin {
  // eslint-disable-next-line no-useless-constructor
  public constructor (private adminStoreDefinition: AdminStore) {
  }

  public setEditing (editing?: boolean) {
    const { isEditing } = storeToRefs(this.adminStore)
    isEditing.value = editing || !isEditing.value
  }

  public get isEditing () {
    return this.adminStore.isEditing
  }

  private get adminStore () {
    return this.adminStoreDefinition.useStore()
  }
}
