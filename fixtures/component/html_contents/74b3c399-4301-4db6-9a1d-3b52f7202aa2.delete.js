export default function (_, res) {
  res.statusCode = 204
  res.send(JSON.stringify({}))
  res.end()
}
