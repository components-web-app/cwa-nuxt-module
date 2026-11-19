import { defineCwaConfig } from '#imports'

defineCwaConfig({
  name: 'Hero',
  description: '<p>Full-width banner</p>',
  instantAdd: true,
  defaultData: { title: 'New hero' },
  allowMultiple: true,
  icon: 'hero',
  group: 'Layout',
  styles: {
    'black-bg': { label: 'Black Background', classes: 'bg-black text-white' },
  },
})

defineCwaConfig({
  // @ts-expect-error an option defineCwaConfig does not take
  managerTabs: ['CwaComponentHeroAdminTab'],
})

defineCwaConfig({
  styles: {
    // @ts-expect-error a style is { label, classes }, never a bare class string
    'black-bg': 'bg-black text-white',
  },
})

defineCwaConfig({
  // @ts-expect-error an icon is a component kind or lucide:<name>
  icon: 'spaceship',
})
