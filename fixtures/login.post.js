export default (req, res) => {
  if (req.body.username !== 'admin' || req.body.password !== 'admin') {
    res.status(401)
    res.send('{"code":401,"message":"Invalid credentials."}')
    return
  }

  res.cookie('api_component', 'valid_jwt', {
    expires: null,
    path: '/',
    maxAge: 604800,
    httpOnly: true,
    sameSite: 'lax',
    secure: false
  })

  res.status(204).send()
}
