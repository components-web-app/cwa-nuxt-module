const path = require('path')
const fs = require('fs')

module.exports.default = (_, res) => {
  const file = path.resolve(
    __dirname,
    './layouts/239e8066-b93b-48fa-aced-33dc6d4377f1'
  )
  const contents = fs.readFileSync(file, 'utf8')
  const layout = JSON.parse(contents)

  const response = {
    '@context': '/contexts/Layout',
    '@id': '/_/layouts',
    '@type': 'hydra:Collection',
    'hydra:member': [layout],
    'hydra:totalItems': 1,
    'hydra:search': {
      '@type': 'hydra:IriTemplate',
      'hydra:template':
        '/_/layouts{?order[createdAt],order[reference],reference,uiComponent}',
      'hydra:variableRepresentation': 'BasicRepresentation',
      'hydra:mapping': [
        {
          '@type': 'IriTemplateMapping',
          variable: 'order[createdAt]',
          property: 'createdAt',
          required: false
        },
        {
          '@type': 'IriTemplateMapping',
          variable: 'order[reference]',
          property: 'reference',
          required: false
        },
        {
          '@type': 'IriTemplateMapping',
          variable: 'reference',
          property: 'reference',
          required: false
        },
        {
          '@type': 'IriTemplateMapping',
          variable: 'uiComponent',
          property: 'uiComponent',
          required: false
        }
      ]
    }
  }
  res.send(JSON.stringify(response))
}
