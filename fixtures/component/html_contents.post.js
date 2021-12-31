import { v4 as uuidv4 } from 'uuid'

export default function (req, res) {
  const newId =
    req.method === 'POST' ? '/component/html_contents/' + uuidv4() : req.url
  if (!req.session.savedResources) {
    req.session.savedResources = {}
  }
  if (!req.session.savedResources.HtmlContent) {
    req.session.savedResources.HtmlContent = {}
  }
  const existingResource = req.session.savedResources.HtmlContent[newId] || null
  const html =
    req.body.html || (existingResource ? existingResource.html : null)

  if (req.body.publishedAt && !html) {
    res.status(422)
    res.send(
      '{"@context":"\\/contexts\\/ConstraintViolationList","@type":"ConstraintViolationList","hydra:title":"An error occurred","hydra:description":"html: This value should not be blank.","violations":[{"propertyPath":"html","message":"This value should not be blank.","code":"c1051bb4-d103-4f74-8988-acbcafc7fdc3"}]}'
    )
    return
  }

  const resource = {
    '@context': '/contexts/HtmlContent',
    '@id': newId,
    '@type': 'HtmlContent',
    html,
    componentPositions: ['/_/component_positions/home_secondary_new_position'],
    componentCollections: req.body.componentCollections || [],
    positionRestricted: false,
    _metadata: {
      persisted: true,
      published: !!req.body.publishedAt,
      publishedAt: req.body.publishedAt || null
    }
  }
  req.session.savedResources.HtmlContent[newId] = resource
  req.session.lastResourceAdded = newId

  return res.send(JSON.stringify(resource))
}
