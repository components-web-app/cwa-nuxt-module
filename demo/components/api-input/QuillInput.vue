<template>
  <div>
    <div ref="quill" v-html="quillModel" />
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import ApiInputMixin from '@cwa/nuxt-module/core/mixins/ApiInputMixin'

export default Vue.extend({
  mixins: [ApiInputMixin],
  data() {
    return {
      editor: null,
      editorOptions: {
        modules: {
          toolbar: {
            container: [
              [
                { header: [false, 1, 2, 3, 4] },
                { size: [false, '7'] },
                {
                  'theme-color': [false, 'primary', 'success']
                }
              ],
              ['bold', 'italic', 'underline'],
              [
                { align: '' },
                { align: 'center' },
                { align: 'justify' },
                { align: 'right' }
              ],
              [{ list: 'ordered' }, { list: 'bullet' }],
              ['link'],
              ['clean']
            ]
          }
        },
        theme: 'snow'
      },
      quillModel: null
    }
  },
  computed: {
    cleanedInputValue() {
      return this.inputValue ? this.inputValue.trim() : this.inputValue
    }
  },
  watch: {
    // when published becomes a draft... need to update content
    iri() {
      this.$nextTick(() => {
        const selection = this.editor.getSelection()
        this.editor.root.innerHTML = this.cleanedInputValue
        if (selection) {
          this.$nextTick(() => {
            this.editor.setSelection(selection.index, selection.length)
          })
        }
      })
    }
  },
  async mounted() {
    this.quillModel = this.cleanedInputValue
    const { default: Quill } = await import('quill')
    this.setupQuill(Quill)
    this.editor = new Quill(this.$refs.quill, this.editorOptions)

    this.editor.enable(false)

    this.$nextTick(() => {
      // https://github.com/quilljs/quill/issues/1184#issuecomment-384935594
      this.editor.clipboard.addMatcher(Node.ELEMENT_NODE, (_, delta) => {
        const ops = []
        delta.ops.forEach((op) => {
          if (op.insert && typeof op.insert === 'string') {
            ops.push({
              insert: op.insert
            })
          }
        })
        delta.ops = ops
        return delta
      })

      // We will add the update event here
      this.editor.on('text-change', () => {
        this.inputValue = this.editor.root.innerHTML
      })

      this.editor.enable(true)
    })
  },
  methods: {
    setupQuill(Quill) {
      // import { sanitize } from 'quill/formats/link'

      // const Font = Quill.import('formats/font')
      // Font.whitelist = ['monda']
      // Quill.register(Font, true)

      const Parchment = Quill.import('parchment')

      const SizeClass = new Parchment.Attributor.Class('size', 'is-size', {
        scope: Parchment.Scope.INLINE,
        whitelist: ['1', '2', '3', '4', '5', '6', '7']
      })
      Quill.register(SizeClass, true)

      const ThemeColorClass = new Parchment.Attributor.Class(
        'theme-color',
        'has-color',
        {
          scope: Parchment.Scope.INLINE,
          whitelist: ['primary', 'success']
        }
      )
      Quill.register(ThemeColorClass, true)

      // class conflict with has-text above
      const AlignClass = new Parchment.Attributor.Class('align', 'text-align', {
        scope: Parchment.Scope.BLOCK,
        whitelist: ['right', 'center', 'justify']
      })
      Quill.register(AlignClass)

      // const Inline = Quill.import('blots/inline')

      // class LinkBlot extends Inline {
      //   static create(value) {
      //     const node = super.create(value)
      //     node.setAttribute('href', this.sanitize(value))
      //     node.setAttribute('rel', 'noopener noreferrer')
      //     node.setAttribute('target', '_blank')
      //     node.setAttribute('class', 'button is-primary is-inverted is-external')
      //     return node
      //   }
      //
      //   static formats(domNode) {
      //     return domNode.getAttribute('href')
      //   }
      //
      //   static sanitize(url) {
      //     return sanitize(url, this.PROTOCOL_WHITELIST) ? url : this.SANITIZED_URL
      //   }
      //
      //   format(name, value) {
      //     if (name !== this.statics.blotName || !value) {
      //       super.format(name, value)
      //     } else {
      //       this.domNode.setAttribute('href', this.constructor.sanitize(value))
      //     }
      //   }
      // }
      // LinkBlot.blotName = 'link_button'
      // LinkBlot.tagName = 'A'
      // LinkBlot.SANITIZED_URL = 'about:blank'
      // LinkBlot.PROTOCOL_WHITELIST = ['http', 'https', 'mailto', 'tel']
      //
      // Quill.register(LinkBlot)
    }
  }
})
</script>

<style lang="sass">
@import '~assets/sass/quill.sass'
.ql-container
  font-size: inherit
  height: auto
  .ql-editor
    text-align: inherit
.ql-snow
  .ql-picker
    &.ql-theme-color
      width: 100px
      .ql-picker-item,
      .ql-picker-label
        &::before
          content: 'Color'
          color: inherit
        &[data-value='primary']::before
          content: 'Primary'
          color: $cwa-color-primary
        &[data-value='success']::before
          content: 'Success'
          color: $color-success
    &.ql-size
      .ql-picker-item,
      .ql-picker-label
        &::before
          content: 'Font size'
        &[data-value='7']::before
          content: 'Small'
          font-size: .7rem
    //&.ql-font
    //  .ql-picker-item,
    //  .ql-picker-label
    //    ::before
    //      content: 'Font'
    //    &[data-value='monda']::before
    //      content: 'Monda'
    //      font-family: 'Monda'
</style>
