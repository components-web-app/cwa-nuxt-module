export default {
  methods: {
    getContextMenuData() {
      let data = null
      if (typeof this.contextMenuData === 'object') {
        data = Object.assign({}, this.contextMenuData)
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
    populateContextMenu() {
      this.$root.$once('contextmenu.show', () => {
        const dataObject = this.getContextMenuData()
        if (!dataObject) {
          return
        }
        this.$root.$emit('contextmenu.addData', this.getContextMenuData())
      })
    }
  },
  mounted() {
    this.$el.addEventListener('contextmenu', this.populateContextMenu)
  },
  beforeDestroy() {
    this.$el.removeEventListener('contextmenu', this.populateContextMenu)
  }
}
