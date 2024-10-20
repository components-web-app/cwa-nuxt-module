import { CwaResourceTypes } from '../../resources/resource-utils'

type PreloadMap = {
  [T in CwaResourceTypes]: Array<string>;
}

const preloadToNextComponent = '/componentGroups/*/componentPositions/*/component'
const preloadHeaders: PreloadMap = {
  [CwaResourceTypes.ROUTE]: [
    `/page/layout${preloadToNextComponent}${preloadToNextComponent}`,
    `/page${preloadToNextComponent}${preloadToNextComponent}`,
    `/pageData/page/layout${preloadToNextComponent}${preloadToNextComponent}`,
    `/pageData/page${preloadToNextComponent}${preloadToNextComponent}`,
  ],
  [CwaResourceTypes.PAGE]: [
    `/layout${preloadToNextComponent}${preloadToNextComponent}`,
    `${preloadToNextComponent}${preloadToNextComponent}`,
  ],
  [CwaResourceTypes.LAYOUT]: [
    `${preloadToNextComponent}${preloadToNextComponent}`,
  ],
  [CwaResourceTypes.PAGE_DATA]: [
    `/page/layout${preloadToNextComponent}${preloadToNextComponent}`,
    `/page${preloadToNextComponent}${preloadToNextComponent}`,
  ],
  [CwaResourceTypes.COMPONENT_GROUP]: [
    `/componentPositions/*/component${preloadToNextComponent}${preloadToNextComponent}`,
  ],
  [CwaResourceTypes.COMPONENT_POSITION]: [
    `/component${preloadToNextComponent}${preloadToNextComponent}`,
  ],
  [CwaResourceTypes.COMPONENT]: [
    preloadToNextComponent,
  ],
}
export default preloadHeaders
