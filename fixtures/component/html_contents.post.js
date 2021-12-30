import { v4 as uuidv4 } from 'uuid'

export default function (req, res) {
  const newId = "\/component\/html_contents\/" + uuidv4()
  if (!req.session.savedResources) {
    req.session.savedResources = {}
  }
  if (!req.session.savedResources.HtmlContent) {
    req.session.savedResources.HtmlContent = []
  }
  req.session.savedResources.HtmlContent.push(newId)
  if (req.body.publishedAt && !req.body.html) {
    res.status(422)
    res.send('{"@context":"\\/contexts\\/ConstraintViolationList","@type":"ConstraintViolationList","hydra:title":"An error occurred","hydra:description":"html: This value should not be blank.","violations":[{"propertyPath":"html","message":"This value should not be blank.","code":"c1051bb4-d103-4f74-8988-acbcafc7fdc3"}]}')
    return
  }
  return res.send(
    JSON.stringify({
      "@context": "\/contexts\/HtmlContent",
      "@id": newId,
      "@type": "HtmlContent",
      "html": req.body.html || null,
      "componentPositions": ['\/_\/component_positions\/home_secondary_new_position'],
      "componentCollections": req.body.componentCollections || [],
      "positionRestricted": false,
      "publishedAt": req.body.publishedAt || null,
      "_metadata": {
        "persisted": true
      }
    })
  )
}
