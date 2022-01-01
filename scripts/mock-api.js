import ApiServer from './api'

if (process.env.API_PORT) {
  const api = new ApiServer()
  api.create().then((app) => {
    app.listen(process.env.API_PORT)
  })
}
