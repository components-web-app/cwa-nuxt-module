export default function (error) {
  const endpoint = error?.response?.config?.url
  if (error.response && error.response.status && typeof error.response.data === 'object') {
    return {
      statusCode: error.response.status,
      message: error.response.data.message || error.response.data['hydra:description'],
      endpoint
    }
  } else if (error.message) {
    return {
      statusCode: 500,
      message: error.message,
      endpoint
    }
  }
  return {
    statusCode: 500,
    message: error,
    endpoint
  }
}
