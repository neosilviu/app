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
