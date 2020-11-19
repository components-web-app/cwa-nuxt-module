export default {
  methods: {
    getContextMenuData () {
      let data = null
      if (typeof this.contextMenuData === 'object') {
        data = Object.assign({}, this.contextMenuData)
      }
      if (typeof this.defaultContextMenuData === 'object') {
        data = Object.assign(data || {}, this.defaultContextMenuData)
      }
      return {
        category: this.contextMenuCategory || null,
        data,
        component: this,
        resource: this.resource
      }
    },
    populateContextMenu () {
      this.removeContextMenuShowListener()
      this.$cwa.$eventBus.$once('cwa:admin-dialog:show', this.contextMenuShowListener)
    },
    contextMenuShowListener () {
      const dataObject = this.getContextMenuData()
      if (!dataObject) {
        return
      }
      this.$cwa.$eventBus.$emit('cwa:admin-dialog:add-component', this.getContextMenuData())
    },
    removeContextMenuShowListener () {
      this.$cwa.$eventBus.$off('cwa:admin-dialog:show', this.contextMenuShowListener)
    },
    initContextmenu () {
      this.$el.addEventListener('click', this.populateContextMenu)
    },
    destroyContextMenu () {
      this.$el.removeEventListener('click', this.populateContextMenu)
      this.removeContextMenuShowListener()
    }
  },
  mounted () {
    this.initContextmenu()
  },
  beforeDestroy () {
    this.destroyContextMenu()
  }
}
