export default function (error) {
  if (error.response && error.response.status && typeof error.response.data === 'object') {
    return {
      statusCode: error.response.status,
      message: error.response.data.message || error.response.data['hydra:description']
    }
  } else if (error.message) {
    return {
      statusCode: 500,
      message: error.message
    }
  }
  return {
    statusCode: 500,
    message: error
  }
}
