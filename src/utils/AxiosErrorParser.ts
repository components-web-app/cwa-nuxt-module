export interface Violation {
  propertyPath: string,
  message: string
}

export interface AxiosError {
  statusCode: number,
  message: string,
  endpoint: string,
  violations?: Violation[]
}

export default function (error): AxiosError {
  const endpoint = error?.response?.config?.url
  if (error.response && error.response.status && typeof error.response.data === 'object') {
    return {
      statusCode: error.response.status,
      message: error.response.data.message || error.response.data['hydra:description'],
      violations: error.response.data.violations,
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
