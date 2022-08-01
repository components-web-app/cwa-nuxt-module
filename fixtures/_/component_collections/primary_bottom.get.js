export default function (_, res) {
  return res.send(
    JSON.stringify({
      '@context': '/contexts/ComponentCollection',
      '@id': '/_/component_collections/primary_bottom',
      '@type': 'ComponentCollection',
      reference: 'primary_bottom',
      location: 'bottom',
      layouts: ['/_/layouts/239e8066-b93b-48fa-aced-33dc6d4377f1'],
      pages: [],
      components: [],
      componentPositions: [
        '/_/component_positions/primary_bottom_new_position'
      ],
      createdAt: '2020-06-24T08:14:52+00:00',
      modifiedAt: '2020-06-24T08:14:52+00:00',
      _metadata: {
        persisted: true
      }
    })
  )
}
