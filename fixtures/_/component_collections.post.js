module.exports.default = function (req, res) {
  return res.send(
    JSON.stringify({
      '@context': '/contexts/ComponentCollection',
      '@id': '/_/component_collections/xxxx-xxxx-xxx-xxxx-xxxxx',
      '@type': 'ComponentCollection',
      reference: req.body.reference,
      location: req.body.location,
      layouts: [],
      pages: req.body.pages,
      components: [],
      componentPositions: [],
      createdAt: '2020-06-24T08:14:52+00:00',
      modifiedAt: '2020-06-24T08:14:52+00:00',
      _metadata: { persisted: true }
    })
  )
}
