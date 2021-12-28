import Quill from 'quill'

<<<<<<< HEAD
import { sanitize } from 'quill/formats/link'
=======
// import { sanitize } from 'quill/formats/link'
>>>>>>> dev

// const Font = Quill.import('formats/font')
// Font.whitelist = ['monda']
// Quill.register(Font, true)

const Parchment = Quill.import('parchment')

const SizeClass = new Parchment.Attributor.Class('size', 'is-size', {
  scope: Parchment.Scope.INLINE,
  whitelist: ['1', '2', '3', '4', '5', '6', '7']
})
Quill.register(SizeClass, true)

<<<<<<< HEAD
const ThemeColorClass = new Parchment.Attributor.Class('theme-color', 'has-color', {
  scope: Parchment.Scope.INLINE,
  whitelist: ['primary', 'success']
})
=======
const ThemeColorClass = new Parchment.Attributor.Class(
  'theme-color',
  'has-color',
  {
    scope: Parchment.Scope.INLINE,
    whitelist: ['primary', 'success']
  }
)
>>>>>>> dev
Quill.register(ThemeColorClass, true)

// class conflict with has-text above
const AlignClass = new Parchment.Attributor.Class('align', 'text-align', {
  scope: Parchment.Scope.BLOCK,
  whitelist: ['right', 'center', 'justify']
})
Quill.register(AlignClass)

<<<<<<< HEAD
const Inline = Quill.import('blots/inline')

class LinkBlot extends Inline {
  static create (value) {
    const node = super.create(value)
    node.setAttribute('href', this.sanitize(value))
    node.setAttribute('rel', 'noopener noreferrer')
    node.setAttribute('target', '_blank')
    node.setAttribute('class', 'button is-primary is-inverted is-external')
    return node
  }

  static formats (domNode) {
    return domNode.getAttribute('href')
  }

  static sanitize (url) {
    return sanitize(url, this.PROTOCOL_WHITELIST) ? url : this.SANITIZED_URL
  }

  format (name, value) {
    if (name !== this.statics.blotName || !value) {
      super.format(name, value)
    } else {
      this.domNode.setAttribute('href', this.constructor.sanitize(value))
    }
  }
}
LinkBlot.blotName = 'link_button'
LinkBlot.tagName = 'A'
LinkBlot.SANITIZED_URL = 'about:blank'
LinkBlot.PROTOCOL_WHITELIST = ['http', 'https', 'mailto', 'tel']

Quill.register(LinkBlot)
=======
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
>>>>>>> dev
