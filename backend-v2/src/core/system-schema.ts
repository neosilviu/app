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
            CREATE TABLE IF NOT EXISTS contact (
                id TEXT PRIMARY KEY,
                workspaceId TEXT REFERENCES workspace(id),
                userId TEXT REFERENCES user(id),
                name TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                company TEXT,
                position TEXT,
                role TEXT DEFAULT 'guest',
                status TEXT DEFAULT 'lead',
                type TEXT DEFAULT 'personal',
                avatarUrl TEXT,
                tag TEXT DEFAULT '[]',
                metadata TEXT DEFAULT '{}',
                last_interaction TEXT,
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
            CREATE TABLE IF NOT EXISTS tag (
                id TEXT PRIMARY KEY,
                workspaceId TEXT REFERENCES workspace(id),
                name TEXT NOT NULL,
                description TEXT,
                color TEXT,
                icon TEXT,
                entityType TEXT,
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

        await db.run(`
            CREATE TABLE IF NOT EXISTS file (
                id TEXT PRIMARY KEY,
                workspaceId TEXT REFERENCES workspace(id),
                filename TEXT NOT NULL,
                originalName TEXT,
                mimeType TEXT,
                size INTEGER,
                category TEXT,
                url TEXT,
                storagePath TEXT,
                uploadedBy TEXT,
                description TEXT,
                tag TEXT,
                path TEXT,
                source TEXT,
                metadata TEXT,
                extracted INTEGER DEFAULT 0,
                extractedFiles TEXT,
                archived INTEGER DEFAULT 0,
                archivedAt DATETIME,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                deletedAt DATETIME,
                createdBy TEXT,
                updatedBy TEXT
            )
        `);

        // 1. system_setting
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

        // 2. audit_log
        await db.run(`
            CREATE TABLE IF NOT EXISTS audit_log (
                id TEXT PRIMARY KEY,
                workspaceId TEXT,
                action TEXT,
                entityType TEXT,
                entityId TEXT,
                display_value TEXT,
                user TEXT,
                userId TEXT,
                details TEXT,
                snapshot_before TEXT,
                snapshot_after TEXT,
                version INTEGER DEFAULT 1,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                deletedAt DATETIME,
                archived INTEGER DEFAULT 0,
                createdBy TEXT,
                updatedBy TEXT
            )
        `);

        // 3. interaction (WhatsApp, Gmail logs) - Enterprise Level 8
        await db.run(`
            CREATE TABLE IF NOT EXISTS interaction (
                id TEXT PRIMARY KEY,
                workspaceId TEXT REFERENCES workspace(id) ON DELETE CASCADE,
                contactId TEXT REFERENCES contact(id) ON DELETE SET NULL,
                chatId TEXT,
                provider TEXT,
                channel TEXT,
                type TEXT,
                direction TEXT,
                body TEXT,
                bodyHtml TEXT,
                subject TEXT,
                status TEXT,
                flow_status TEXT DEFAULT 'new',
                fromMe INTEGER,
                remoteId TEXT,
                attachments TEXT,
                labels TEXT,
                metadata TEXT,
                isPinned INTEGER DEFAULT 0,
                isFavorite INTEGER DEFAULT 0,
                isArchive INTEGER DEFAULT 0,
                isTrash INTEGER DEFAULT 0,
                readAt DATETIME,
                tag TEXT DEFAULT '[]',
                contentFetched INTEGER DEFAULT 0,
                archived INTEGER DEFAULT 0,
                archivedAt DATETIME,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                deletedAt DATETIME,
                createdBy TEXT,
                updatedBy TEXT
            )
        `);

        // 4. entity_attachment (Polymorphic) - Enterprise Level 8
        await db.run(`
            CREATE TABLE IF NOT EXISTS entity_attachment (
                id TEXT PRIMARY KEY,
                workspaceId TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
                fileId TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
                entityType TEXT NOT NULL,
                entityId TEXT NOT NULL,
                category TEXT,
                archived INTEGER DEFAULT 0,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                deletedAt DATETIME,
                createdBy TEXT,
                updatedBy TEXT
            )
        `);

        // 5. entity_definition (Dynamic overrides) - Enterprise Alliance Level 113
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
                uiConfig TEXT,
                menuConfig TEXT,
                permissions TEXT,
                features TEXT,
                layout TEXT,
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

        // 6. printing_session
        await db.run(`
            CREATE TABLE IF NOT EXISTS printing_session (
                id TEXT PRIMARY KEY,
                name TEXT,
                config TEXT, 
                status TEXT, 
                workspaceId TEXT,
                archived INTEGER DEFAULT 0,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deletedAt DATETIME,
                createdBy TEXT,
                updatedBy TEXT
            )
        `);

        // 7. inbox_notification
        await db.run(`
            CREATE TABLE IF NOT EXISTS inbox_notification (
                id TEXT PRIMARY KEY,
                source TEXT,
                senderName TEXT,
                senderId TEXT,
                body TEXT,
                hasAttachments INTEGER DEFAULT 0,
                attachmentCount INTEGER DEFAULT 0,
                timestamp TEXT,
                status TEXT DEFAULT 'new',
                workspaceId TEXT DEFAULT 'system',
                archived INTEGER DEFAULT 0,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deletedAt DATETIME,
                createdBy TEXT,
                updatedBy TEXT
            )
        `);

        // 8. inbox_file
        await db.run(`
            CREATE TABLE IF NOT EXISTS inbox_file (
                id TEXT PRIMARY KEY,
                notificationId TEXT,
                filename TEXT,
                path TEXT,
                mimeType TEXT,
                size INTEGER,
                status TEXT DEFAULT 'active',
                workspaceId TEXT,
                archived INTEGER DEFAULT 0,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deletedAt DATETIME,
                createdBy TEXT,
                updatedBy TEXT
            )
        `);

        // 9. tag_assignment
        await db.run(`
            CREATE TABLE IF NOT EXISTS tag_assignment (
                id TEXT PRIMARY KEY,
                workspaceId TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
                tagId TEXT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
                entityType TEXT NOT NULL,
                entityId TEXT NOT NULL,
                archived INTEGER DEFAULT 0,
                archivedAt DATETIME,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                deletedAt DATETIME,
                createdBy TEXT,
                updatedBy TEXT
            )
        `);

        // 10. system_status
        await db.run(`
            CREATE TABLE IF NOT EXISTS system_status (
                id TEXT PRIMARY KEY,
                workspaceId TEXT,
                service_name TEXT,
                status TEXT, 
                uptime INTEGER,
                last_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                load_avg REAL,
                memory_usage TEXT, 
                metadata_json TEXT,
                archived INTEGER DEFAULT 0,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deletedAt DATETIME,
                createdBy TEXT,
                updatedBy TEXT
            )
        `);

        // 11. _ai_prompt (Enterprise AI Engine)
        await db.run(`
            CREATE TABLE IF NOT EXISTS _ai_prompt (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                template TEXT NOT NULL,
                model TEXT,
                provider TEXT,
                config TEXT,
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

