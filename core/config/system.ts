import { safeEnv, isDev } from '../utils/env';

const DEFAULT_AGENT_PORT = isDev ? '4001' : '5000';
const DEFAULT_AGENT_URL = isDev ? `http://localhost:${DEFAULT_AGENT_PORT}` : '';

export { DEFAULT_AGENT_PORT, DEFAULT_AGENT_URL };

export const SYSTEM_SETTING = {
  use_local_agent: false, // Use Local Node.js Agent (WhatsApp, Hardware, etc)
  enable_worker: false, // Master switch for all background processes (V2)
  worker_whatsapp_enabled: false,
  worker_gmail_enabled: false,
  worker_print_enabled: false,
  worker_indexer_enabled: false,
  worker_archive_enabled: false,
  workspace_name: 'Studio App',
  logo_url: '/logo.png',
  file_retention_days: 30,
  max_backups: 10,
  sync_heavy_data: false, // Toggle for Cloud D1 synchronization
  local_inbox_path: '../local-inbox',
  local_config_path: '../backend-v2/config',
  local_agent_port: parseInt(safeEnv('LOCAL_AGENT_PORT', DEFAULT_AGENT_PORT)),
  local_agent_url: safeEnv('LOCAL_AGENT_URL', DEFAULT_AGENT_URL),
  libreoffice_path: 'C:\\Program file\\LibreOffice\\program\\soffice.exe',
  allowed_file_browser_roots: ['C:\\', 'D:\\', '../', '../local-inbox'],
  printing_allowed_extensions: ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp', '.rtf', '.txt', '.pages', '.numbers', '.key', '.zip', '.rar'],
  printing_sessions_limit: 50,
  recent_arrivals_limit: 20,
  ai: {
    priority_provider: 'cloudflare',
    model: '',
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
    debugMode: isDev,
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
      safeEnv('FRONTEND_URL', 'https://service.aemdpc.ro'),
    ],
    csrfProtection: true,
    helmetEnabled: true,
    contentSecurityPolicy: {
      enabled: true,
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:', 'http:', '*'],
      },
    },
  },
} as const;
