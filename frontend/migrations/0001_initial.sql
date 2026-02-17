-- Unified Initial Schema (Enterprise Level 10 - Minimalist & Zod-Aligned)
-- Source of Truth: app/core/entities/*.ts

-- ==========================================
-- 1. IDENTITY & AUTH (Better-Auth)
-- ==========================================

CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    emailVerified INTEGER DEFAULT 0,
    image TEXT,
    role TEXT DEFAULT 'user',
    active INTEGER DEFAULT 1,
    workspaceId TEXT,
    archived INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    expiresAt INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt INTEGER,
    refreshTokenExpiresAt INTEGER,
    scope TEXT,
    password TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);

-- ==========================================
-- 2. SYSTEM INFRASTRUCTURE
-- ==========================================

CREATE TABLE IF NOT EXISTS workspace (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT UNIQUE,
    ownerId TEXT,
    avatarUrl TEXT,
    setting TEXT,
    archived INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

CREATE TABLE IF NOT EXISTS workspace_user (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'user',
    archived INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspaceId, userId)
);

CREATE TABLE IF NOT EXISTS entity_relation_many (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL,
    sourceId TEXT NOT NULL,
    sourceType TEXT NOT NULL,
    targetId TEXT NOT NULL,
    targetType TEXT NOT NULL,
    fieldName TEXT,
    metadata TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS _metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_performance_log (
    id TEXT PRIMARY KEY,
    query TEXT,
    durationMs INTEGER,
    affectedTable TEXT,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- BOOTSTRAP
INSERT OR IGNORE INTO _metadata (key, value) VALUES ('db_version', '10.0');
INSERT OR IGNORE INTO _metadata (key, value) VALUES ('system_status', '{"v3": true}');
