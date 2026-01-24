/**
 * REGISTRY CONFIG - System, Auth, Database, and Integrations
 * Enterprise Level 8
 */
import { SYSTEM_ROLE } from './core';

const safeEnv = (key: string, fallback: string = ''): string => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] || fallback;
  }
  return fallback;
};

const DEFAULT_AGENT_PORT = '5000';

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

export const INTEGRATION = {
  whatsapp: {
    enabled: true,
    provider: 'twilio',
    accountSidEnvVar: 'TWILIO_ACCOUNT_SID',
    authTokenEnvVar: 'TWILIO_AUTH_TOKEN',
    phoneNumberEnvVar: 'TWILIO_PHONE_NUMBER',
    webhookSecret: safeEnv('WHATSAPP_WEBHOOK_SECRET', 'your-webhook-secret'),
    messageTimeout: 30000,
    maxRetries: 3,
  },
  gmail: {
    enabled: true,
    clientIdEnvVar: 'GMAIL_CLIENT_ID',
    clientSecretEnvVar: 'GMAIL_CLIENT_SECRET',
    refreshTokenEnvVar: 'GMAIL_REFRESH_TOKEN',
    maxEmailsPerSync: 50,
    syncInterval: 3600,
  },
  slack: {
    enabled: false,
    botTokenEnvVar: 'SLACK_BOT_TOKEN',
    signingSecretEnvVar: 'SLACK_SIGNING_SECRET',
  },
} as const;

export const EMAIL_TEMPLATE = {
  workspace_invitation: {
    subject: {
      ro: "Invitație Workspace - {{workspaceName}}",
      en: "Workspace Invitation - {{workspaceName}}"
    },
    body: {
      ro: "Bună ziua,\n\nAți fost invitat să vă alăturați workspace-ului \"{{workspaceName}}\" pe platforma Studio App cu rolul de {{roleLabel}}.\n\nPuteți accesa platforma aici: {{appUrl}}\n\nEchipa Studio App",
      en: "Hello,\n\nYou have been invited to join the workspace \"{{workspaceName}}\" on the Studio App platform with the role of {{roleLabel}}.\n\nYou can access the platform here: {{appUrl}}\n\nThe Studio App Team"
    },
    html: {
      ro: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #4f46e5;">Invitație Workspace Nou</h2>
          <p>Bună ziua,</p>
          <p>Ați fost invitat să vă alăturați workspace-ului <strong>{{workspaceName}}</strong> cu rolul de <strong>{{roleLabel}}</strong>.</p>
          <div style="margin: 30px 0;">
            <a href="{{appUrl}}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Accesează Studio App</a>
          </div>
          <p style="color: #666; font-size: 12px;">Dacă nu recunoașteți această invitație, vă rugăm să ignorați acest email.</p>
        </div>
      `,
      en: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #4f46e5;">New Workspace Invitation</h2>
          <p>Hello,</p>
          <p>You have been invited to join the workspace <strong>{{workspaceName}}</strong> with the role of <strong>{{roleLabel}}</strong>.</p>
          <div style="margin: 30px 0;">
            <a href="{{appUrl}}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Access Studio App</a>
          </div>
          <p style="color: #666; font-size: 12px;">If you do not recognize this invitation, please ignore this email.</p>
        </div>
      `
    }
  }
} as const;

export const FILE_CONFIG = {
  categories: {
    document: {
      label: { ro: 'Documente', en: 'Documents' },
      icon: 'FileText',
      mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
    },
    image: {
      label: { ro: 'Imagini', en: 'Images' },
      icon: 'Image',
      mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    },
    media: {
      label: { ro: 'Media', en: 'Media' },
      icon: 'Film',
      mimeTypes: ['video/mp4', 'video/mpeg', 'audio/mpeg', 'audio/wav', 'audio/aac'],
    },
    archive: {
      label: { ro: 'Arhive', en: 'Archives' },
      icon: 'Archive',
      mimeTypes: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/x-tar'],
    },
    spreadsheet: {
      label: { ro: 'Tabele', en: 'Spreadsheets' },
      icon: 'Sheet',
      mimeTypes: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
    },
  },
  storage: {
    type: 'local',
    uploadDir: './uploads',
    maxFileSize: 50 * 1024 * 1024,
    maxTotalSize: 5 * 1024 * 1024 * 1024,
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'video/mp4',
      'audio/mpeg',
    ],
    s3: {
      bucketEnvVar: 'AWS_S3_BUCKET',
      regionEnvVar: 'AWS_REGION',
      accessKeyIdEnvVar: 'AWS_ACCESS_KEY_ID',
      secretAccessKeyEnvVar: 'AWS_SECRET_ACCESS_KEY',
    },
  },
  processing: {
    generateThumbnails: true,
    thumbnailSizes: [80, 200, 400],
    extractMetadata: true,
    virusScan: true,
    textExtraction: true,
  },
} as const;

export const I18N_CONFIG = {
  defaultLanguage: 'ro',
  supportedLanguages: {
    en: { name: 'English', nativeName: 'English', direction: 'ltr' },
    ro: { name: 'Romanian', nativeName: 'Română', direction: 'ltr' },
  },
  timezone: {
    default: 'UTC',
    userSelectable: true,
  },
  dateFormat: {
    default: 'DD/MM/YYYY',
    locale: {
      en: 'MM/DD/YYYY',
      ro: 'DD/MM/YYYY',
      es: 'DD/MM/YYYY',
      fr: 'DD/MM/YYYY',
    },
  },
  currencyFormat: {
    default: 'USD',
    locale: {
      en: 'USD',
      ro: 'RON',
      es: 'EUR',
      fr: 'EUR',
    },
  },
} as const;

export const SYSTEM_SETTING = {
  use_local_agent: false,
  enable_worker: false,
  worker_whatsapp_enabled: false,
  worker_gmail_enabled: false,
  worker_print_enabled: false,
  worker_indexer_enabled: false,
  worker_archive_enabled: false,
  workspace_name: 'Studio App',
  logo_url: '/logo.png',
  file_retention_days: 30,
  max_backups: 10,
  sync_heavy_data: false,
  local_inbox_path: '../local-inbox',
  local_config_path: '../backend-v2/config',
  local_agent_port: parseInt(safeEnv('LOCAL_AGENT_PORT', DEFAULT_AGENT_PORT)),
  local_agent_url: safeEnv('LOCAL_AGENT_URL', 'https://api.aemdpc.ro'),
  libreoffice_path: 'C:\\Program file\\LibreOffice\\program\\soffice.exe',
  allowed_file_browser_roots: ['C:\\', 'D:\\', '../', '../local-inbox'],
  printing_allowed_extensions: ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp', '.rtf', '.txt', '.pages', '.numbers', '.key', '.zip', '.rar'],
  printing_sessions_limit: 50,
  recent_arrivals_limit: 20,
  ai: {
    priority_provider: 'cloudflare',
    model: 'gemini-1.5-pro',
    temperature: 0.7,
    max_tokens: 2048,
    agent_personality: 'professional',
    rag_enabled: true,
    auto_reply_enabled: false,
  },
  gmail: {
    active: false,
    autoReply: false,
    aiAnalysis: true,
    syncInterval: 60,
    syncLabels: 'INBOX,SENT',
    autoDownload: false,
  },
  whatsapp: {
    active: false,
    autoReply: false,
    aiAnalysis: true,
    autoDownload: false,
    mediaLimit: 16,
  },
  app: {
    maintenanceMode: false,
    debugMode: safeEnv('NODE_ENV') === 'development',
    logLevel: safeEnv('LOG_LEVEL', 'info'),
    maxDashboardWidgets: 12,
  },
  email: {
    enabled: true,
    from: safeEnv('MAIL_FROM', 'noreply@studioapp.local'),
    fromName: 'Studio App',
    provider: 'smtp',
    smtpHost: safeEnv('SMTP_HOST', 'localhost'),
    smtpPort: parseInt(safeEnv('SMTP_PORT', '587')),
    smtpSecure: safeEnv('SMTP_SECURE') === 'true',
    smtpUser: safeEnv('SMTP_USER'),
    smtpPassword: safeEnv('SMTP_PASSWORD'),
  },
  notification: {
    email: true,
    inApp: true,
    push: false,
    sms: false,
    maxNotificationHistory: 100,
  },
  search: {
    enabled: true,
    debounceMs: 300,
    minChars: 2,
    maxResults: 50,
    highlightResults: true,
  },
  export: {
    maxRecords: 10000,
    formats: ['csv', 'json', 'xlsx'],
    defaultFormat: 'csv',
  },
  import: {
    enabled: true,
    maxFileSize: 10 * 1024 * 1024,
    formats: ['csv', 'json', 'xlsx'],
    maxBatchSize: 100,
  },
  backup: {
    enabled: true,
    frequency: 'daily',
    retentionDays: 30,
    autoBackupTime: '02:00',
    backupDir: './backups',
  },
  rateLimit: {
    enabled: true,
    windowMs: 900000,
    maxRequests: 100,
    message: 'Too many requests, please try again later.',
  },
  security: {
    corsEnabled: true,
    allowedOrigins: [
      'https://service.aemdpc.ro',
      'http://localhost:8788',
      'https://service.aemdpc.ro',
    ],
    csrfProtection: true,
    helmetEnabled: true,
    contentSecurityPolicy: {
      enabled: true,
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  },
} as const;

export const DATABASE_CONFIG = {
  type: safeEnv('DATABASE_TYPE', 'sqlite'),
  sqlite: {
    filename: safeEnv('DATABASE_PATH', './db/local_db.sqlite'),
    memory: false,
    verbose: false,
  },
  d1: {
    accountIdEnvVar: 'CLOUDFLARE_ACCOUNT_ID',
    apiTokenEnvVar: 'CLOUDFLARE_API_TOKEN',
    databaseIdEnvVar: 'CLOUDFLARE_D1_DATABASE_ID',
  },
  migrations: {
    enabled: true,
    autoMigrate: true,
    migrationDir: './migrations',
  },
  connection: {
    timeout: 5000,
    maxConnections: 10,
    idleTimeout: 30000,
  },
} as const;

export const SOCKET_CONFIG = {
  enabled: true,
  port: parseInt(safeEnv('SOCKET_PORT', DEFAULT_AGENT_PORT)),
  cors: {
    origin: [
      'https://service.aemdpc.ro',
      'http://localhost:8788',
      'https://service.aemdpc.ro',
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  namespaces: {
    default: '/',
    admin: '/admin',
    notification: '/notification',
  },
} as const;

export const WORKER_CONFIG = {
  enabled: true,
  concurrency: 4,
  timeout: 300000,
  worker: {
    emailWorker: {
      enabled: true,
      queue: 'email',
      maxRetries: 3,
    },
    smsWorker: {
      enabled: true,
      queue: 'sms',
      maxRetries: 3,
    },
    fileProcessingWorker: {
      enabled: true,
      queue: 'fileProcessing',
      maxRetries: 2,
    },
    reportGenerationWorker: {
      enabled: true,
      queue: 'reportGeneration',
      maxRetries: 2,
    },
    syncWorker: {
      enabled: true,
      queue: 'sync',
      maxRetries: 5,
    },
  },
} as const;

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
