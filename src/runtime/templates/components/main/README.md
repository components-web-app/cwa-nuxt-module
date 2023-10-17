Components in this directory are available to the application automatically with the 'Cwa' prefix.
N.b directories starting with an underscore will not be available as an auto-import or from the #components alias

For example:
```vue
<CwaComponentGroup reference="primary" :location="props.iri" />
```
