export default {
  methods: {
    getAdminDialogItem () {
      // let data = null
      // if (typeof this.contextMenuData === 'object') {
      //   data = Object.assign({}, this.contextMenuData)
      // }
      // if (typeof this.defaultContextMenuData === 'object') {
      //   data = Object.assign(data || {}, this.defaultContextMenuData)
      // }
      return {
        name: this.adminDialogName || null,
        resource: this.resource
      }
    },
    populateContextMenu () {
      this.$cwa.$eventBus.$once('cwa:admin-dialog:show', this.contextMenuShowListener)
      // we should only be populating when the element is clicked and the show event is called
      // if we click, but this results in the context menu hiding (it is already shown)
      // we should remove the event listener to prevent it being fired if the next click
      // is not on this component
      setTimeout(() => {
        this.removeAdminDialogShowListener()
      }, 0)
    },
    contextMenuShowListener () {
      this.$cwa.$eventBus.$emit('cwa:admin-dialog:add-item', this.getAdminDialogItem())
    },
    removeAdminDialogShowListener () {
      this.$cwa.$eventBus.$off('cwa:admin-dialog:show', this.contextMenuShowListener)
    },
    initAdminDialogListener () {
      this.$el.addEventListener('click', this.populateContextMenu)
    },
    destroyAdminDialogListener () {
      this.$el.removeEventListener('click', this.populateContextMenu)
    }
  },
  mounted () {
    this.initAdminDialogListener()
  },
  beforeDestroy () {
    this.destroyAdminDialogListener()
  }
}
