import { safeEnv } from '../utils/env';
import { DEFAULT_AGENT_PORT } from './system';

export const SOCKET_CONFIG = {
  enabled: true,
  port: parseInt(safeEnv('SOCKET_PORT', DEFAULT_AGENT_PORT)),
  cors: {
    origin: [
      'https://service.aemdpc.ro',
      'http://localhost:8788',
      safeEnv('FRONTEND_URL', 'https://service.aemdpc.ro'),
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
