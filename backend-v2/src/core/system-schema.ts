// Ensure critical system tables exist
import { DatabaseDriver } from '../db/driver';
import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    transports: [new winston.transports.Console()],
    defaultMeta: { service: 'system-schema' }
});

export class SystemSchema {
    public static async ensureTables(): Promise<void> {
        const db = DatabaseDriver.getInstance();
        logger.info('Verifying system tables...');

        // 0. Core Entities Skeleton (Level 8)
        await db.run(`
            CREATE TABLE IF NOT EXISTS workspace (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                slug TEXT UNIQUE,
                ownerId TEXT,
                avatarUrl TEXT,
                settings TEXT,
                status TEXT DEFAULT 'active',
                archived INTEGER DEFAULT 0,
                archivedAt DATETIME,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                deletedAt DATETIME,
                createdBy TEXT,
                updatedBy TEXT
            )
        `);

        await db.run(`
            CREATE TABLE IF NOT EXISTS user (
                id TEXT PRIMARY KEY, 
                name TEXT NOT NULL, 
                email TEXT UNIQUE NOT NULL, 
                emailVerified INTEGER DEFAULT 0, 
                image TEXT, 
                role TEXT DEFAULT 'user', 
                preferredLanguage TEXT DEFAULT 'ro', 
                workspaceId TEXT,
                lastWorkspaceId TEXT, 
                status TEXT DEFAULT 'active', 
                archived INTEGER DEFAULT 0, 
                archivedAt DATETIME, 
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, 
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, 
                deletedAt DATETIME, 
                createdBy TEXT, 
                updatedBy TEXT
            )
        `);

        await db.run(`
            CREATE TABLE IF NOT EXISTS session (
                id TEXT PRIMARY KEY, 
                expiresAt INTEGER NOT NULL, 
                token TEXT NOT NULL UNIQUE, 
                createdAt INTEGER NOT NULL, 
                updatedAt INTEGER NOT NULL, 
                ipAddress TEXT, 
                userAgent TEXT, 
                userId TEXT NOT NULL REFERENCES user(id),
                archived INTEGER DEFAULT 0,
                archivedAt DATETIME,
                deletedAt DATETIME,
                workspaceId TEXT,
                createdBy TEXT,
                updatedBy TEXT
            )
        `);

        await db.run(`
            CREATE TABLE IF NOT EXISTS account (
                id TEXT PRIMARY KEY, 
                userId TEXT NOT NULL REFERENCES user(id), 
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
                updatedAt INTEGER NOT NULL,
                archived INTEGER DEFAULT 0,
                archivedAt DATETIME,
                deletedAt DATETIME,
                workspaceId TEXT,
                createdBy TEXT,
                updatedBy TEXT
            )
        `);

        await db.run(`
            CREATE TABLE IF NOT EXISTS system_setting (
                id TEXT PRIMARY KEY,
                namespace TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT,
                dataType TEXT DEFAULT 'text',
                description TEXT,
                isSecret INTEGER DEFAULT 0,
                workspaceId TEXT,
                archived INTEGER DEFAULT 0,
                archivedAt DATETIME,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                deletedAt DATETIME,
                createdBy TEXT,
                updatedBy TEXT,
                UNIQUE(namespace, key)
            )
        `);

        // 6. entity_definition (Dynamic overrides) - Enterprise Alliance Level 113
        await db.run(`
            CREATE TABLE IF NOT EXISTS entity_definition (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                label TEXT,
                labelPlural TEXT,
                description TEXT,
                icon TEXT DEFAULT 'Box',
                colorTheme TEXT,
                tableName TEXT,
                displayField TEXT,
                fields TEXT NOT NULL,
                validations TEXT,
                relationships TEXT,
                dependencies TEXT,
                uiConfig TEXT,
                menuConfig TEXT,
                permission TEXT,
                features TEXT,
                layout TEXT,
                actions TEXT,
                flowRules TEXT,
                dashboardConfig TEXT,
                isSystem INTEGER DEFAULT 0,
                workspaceId TEXT DEFAULT 'system',
                archived INTEGER DEFAULT 0,
                archivedAt DATETIME,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                deletedAt DATETIME,
                createdBy TEXT,
                updatedBy TEXT,
                UNIQUE(name, workspaceId)
            )
        `);

        // 11. _ai_prompt (Enterprise AI Engine)
        await db.run(`
            CREATE TABLE IF NOT EXISTS _ai_prompt (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                template TEXT NOT NULL,
                systemPrompt TEXT,
                userPromptTemplate TEXT,
                model TEXT,
                provider TEXT,
                config TEXT,
                inputContext TEXT,
                outputField TEXT,
                category TEXT,
                isLocked INTEGER DEFAULT 0,
                description TEXT,
                workspaceId TEXT DEFAULT 'system',
                archived INTEGER DEFAULT 0,
                archivedAt DATETIME,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                deletedAt DATETIME,
                createdBy TEXT,
                updatedBy TEXT
            )
        `);

        logger.info('✅ System tables verified.');
    }
}

