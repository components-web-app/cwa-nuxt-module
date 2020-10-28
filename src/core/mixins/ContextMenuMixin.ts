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
      if (!data) {
        return null
      }
      return {
        category: this.contextMenuCategory || null,
        data,
        component: this
      }
    },
    populateContextMenu () {
      this.removeContextMenuShowListener()
      this.$root.$once('contextmenu.show', this.contextMenuShowListener)
    },
    contextMenuShowListener () {
      const dataObject = this.getContextMenuData()
      if (!dataObject) {
        return
      }
      this.$root.$emit('context-menu-add-data', this.getContextMenuData())
    },
    removeContextMenuShowListener () {
      this.$root.$off('contextmenu.show', this.contextMenuShowListener)
    },
    initContextmenu () {
      this.$el.addEventListener('contextmenu', this.populateContextMenu)
    },
    destroyContextMenu () {
      this.$el.removeEventListener('contextmenu', this.populateContextMenu)
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
