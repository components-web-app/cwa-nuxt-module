import Vue from 'vue'
import ComponentMixin from '@cwa/nuxt-module/core/mixins/ComponentMixin'

// eslint-disable-next-line vue/one-component-per-file
export default Vue.extend({
  mixins: [ComponentMixin],
  methods: {
    getHtmlAsComponent(html) {
      html =
        html ||
        (this.$cwa.isAdmin
          ? '<p style="font-style: italic">No content</p>'
          : '')
      if (this.isMounted) {
        const div = document.createElement('div')
        div.innerHTML = html
        const anchors = div.getElementsByTagName('a')
        Array.from(anchors).forEach((anchor) => {
          anchor.parentNode.replaceChild(this.convertAnchor(anchor), anchor)
        })
        html = div.innerHTML
      }
      // eslint-disable-next-line vue/one-component-per-file
      return Vue.extend({
        components: {
          CwaNuxtLink: () =>
            import(
              '@cwa/nuxt-module/core/templates/components/utils/cwa-nuxt-link.vue'
            )
        },
        props: this.$options.props,
        template: '<div>' + html + '</div>'
      })
    },
    convertAnchor(anchor) {
      const newLink = document.createElement('cwa-nuxt-link')
      newLink.setAttribute('to', anchor.getAttribute('href'))
      for (const attr of anchor.attributes) {
        if (!['href', 'target', 'rel'].includes(attr.name)) {
          newLink.setAttribute(attr.name, anchor[attr.name])
        }
      }
      newLink.innerHTML = anchor.innerHTML
      return newLink
    }
  }
})
