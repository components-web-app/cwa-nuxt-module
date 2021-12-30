import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

export default (_, res) => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const file = path.resolve(
    __dirname,
    './pages/1d2c947a-8726-4dc7-8f24-655f45e91f68'
  )
  const contents = fs.readFileSync(file, 'utf8')
  const page = JSON.parse(contents)

  const response = {
    '@context': '/contexts/Page',
    '@id': '/_/pages',
    '@type': 'hydra:Collection',
    'hydra:member': [page],
    'hydra:totalItems': 1,
    'hydra:search': {
      '@type': 'hydra:IriTemplate',
      'hydra:template':
        '/_/pages{?order[createdAt],order[reference],title,reference,isTemplate,isTemplate[],uiComponent,layout.reference}',
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
          variable: 'title',
          property: 'title',
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
          variable: 'isTemplate',
          property: 'isTemplate',
          required: false
        },
        {
          '@type': 'IriTemplateMapping',
          variable: 'isTemplate[]',
          property: 'isTemplate',
          required: false
        },
        {
          '@type': 'IriTemplateMapping',
          variable: 'uiComponent',
          property: 'uiComponent',
          required: false
        },
        {
          '@type': 'IriTemplateMapping',
          variable: 'layout.reference',
          property: 'layout.reference',
          required: false
        }
      ]
    }
  }
  res.send(JSON.stringify(response))
}
