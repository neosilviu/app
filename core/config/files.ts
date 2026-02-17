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
