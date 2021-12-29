module.exports.default = (_, res) => {
  res.cookie('api_component', 'xxx', {
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/'
  })
  res.status(200)
  res.send()
}
