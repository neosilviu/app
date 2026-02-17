import { SYSTEM_ROLE } from './roles';

export const AUTH_CONFIG = {
  enabled: true,
  sessionTimeout: 86400 * 7,
  tokenExpiry: 3600,
  refreshTokenExpiry: 604800,
  strategies: {
    local: {
      enabled: true,
      passwordMinLength: 8,
      passwordRequireUppercase: true,
      passwordRequireNumbers: true,
      passwordRequireSpecialChars: true,
    },
    google: {
      enabled: false,
      clientIdEnvVar: 'GOOGLE_CLIENT_ID',
      clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
      callbackUrl: '/auth/google/callback',
    },
    github: {
      enabled: false,
      clientIdEnvVar: 'GITHUB_CLIENT_ID',
      clientSecretEnvVar: 'GITHUB_CLIENT_SECRET',
      callbackUrl: '/auth/github/callback',
    },
  },
  mfa: {
    enabled: true,
    methods: ['totp', 'sms'],
    required: false,
  },
  role: SYSTEM_ROLE,
} as const;
