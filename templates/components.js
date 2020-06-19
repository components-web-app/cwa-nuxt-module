export default {
<%= options.components.map(c => {
    const exp = c.export === 'default' ? `c.default || c` : `c['${c.export}']`
    const regex = new RegExp(`^LazyCwa${options.prefix}`)
    return `  ${c.pascalName.replace(regex, '')}: () => ({
    component: import('../${relativeToBuild(c.filePath)}' /* webpackChunkName: "${c.chunkName}" */).then(c => ${exp})
  })`
  }).join(",\n") %>
}
