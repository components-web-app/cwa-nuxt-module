export default function (_, res) {
  return res.send(
    JSON.stringify({
      '@context': '/contexts/ComponentGroup',
      '@id': '/_/component_groups/primary_bottom',
      '@type': 'ComponentGroup',
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
