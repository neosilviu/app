export const API_CONFIG = {
  version: 'v1',
  baseUrl: '/api/v1',
  defaultTimeout: 15000,
  pagination: {
    defaultPageSize: 20,
    maxPageSize: 100,
  },
  rateLimit: {
    enabled: true,
    requestsPerMinute: 60,
  },
  authentication: {
    headerName: 'Authorization',
    scheme: 'Bearer',
    cookieName: 'auth_token',
  },
} as const;
