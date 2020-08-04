import { StoreCategories } from '../storage'
import ResourceMixin from './ResourceMixin'

const category = StoreCategories.Component

export default {
  ...ResourceMixin(category)
}
