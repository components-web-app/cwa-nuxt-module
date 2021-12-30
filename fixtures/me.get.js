export default (req, res) => {
  if (req.cookies.api_component !== 'valid_jwt') {
    res.status(404)
    res.send('')
    return
  }

  const data = JSON.stringify({
    '@context': '/contexts/User',
    '@id': '/users/7c33c9fb-a2fd-48f5-ab86-2ccaa0d1f57d',
    '@type': 'User',
    username: 'admin',
    emailAddress: 'hello@cwa.rocks',
    roles: [
      'ROLE_SUPER_ADMIN',
      'ROLE_ADMIN',
      'ROLE_ALLOWED_TO_SWITCH',
      'ROLE_USER'
    ],
    enabled: true,
    _metadata: { persisted: true }
  })
  res.status(200)
  res.send(data)
}
