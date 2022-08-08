export default function (_, res) {
  res.send(
    JSON.stringify({
      '@context': '/contexts/HtmlContent',
      '@id': '/component/html_contents/74b3c399-4301-4db6-9a1d-3b52f7202aa2',
      '@type': 'HtmlContent',
      html: '\u003Cp\u003EBonjour mon ami\u003C/p\u003E',
      componentPositions: [
        '/_/component_positions/bcec8679-3a54-4baa-b485-d2579f1687f5'
      ],
      componentCollections: [],
      positionRestricted: false,
      _metadata: {
        persisted: true
      }
    })
  )
  res.end()
}
