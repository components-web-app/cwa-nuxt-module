export default function (req, res) {
  return res.send(
    JSON.stringify({
      '@context': '/contexts/ComponentPosition',
      '@id': '/_/component_positions/home_secondary_new_position',
      '@type': 'ComponentPosition',
      componentCollection: '/_/component_collections/home_secondary',
      component: req.session.lastResourceAdded,
      sortValue: 0,
      createdAt: '2020-06-24T08:14:52+00:00',
      modifiedAt: '2020-06-24T08:14:52+00:00',
      _metadata: {
        persisted: true
      }
    })
  )
}
