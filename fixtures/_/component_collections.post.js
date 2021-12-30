import { v4 as uuidv4 } from 'uuid'

export default function (req, res) {
  return res.send(
    JSON.stringify({
      '@context': '/contexts/ComponentCollection',
      '@id': '/_/component_collections/' + (req.body.reference || uuidv4()),
      '@type': 'ComponentCollection',
      reference: req.body.reference,
      location: req.body.location,
      layouts: req.body.layouts || [],
      pages: req.body.pages || [],
      components: [],
      componentPositions: [],
      createdAt: '2020-06-24T08:14:52+00:00',
      modifiedAt: '2020-06-24T08:14:52+00:00',
      _metadata: { persisted: true }
    })
  )
}
