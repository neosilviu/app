-- Seed workspace
INSERT OR REPLACE INTO workspace (id, name, archived, createdAt, updatedAt) 
VALUES ('ws-prod', 'Studio Production', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Seed User (Better-Auth)
INSERT OR REPLACE INTO user (id, name, email, emailVerified, createdAt, updatedAt, role, workspaceId)
VALUES ('admin-id', 'Production Admin', 'admin@admin', 1, 1737220000000, 1737220000000, 'superadmin', 'ws-prod');

-- Seed Account (Better-Auth Credentials)
INSERT OR REPLACE INTO account (id, userId, accountId, providerId, password, createdAt, updatedAt)
VALUES ('acc-admin-id', 'admin-id', 'admin@admin', 'credential', '42539091807662c59505c87a20c904e5784e1b017992ef1f3f4e24eb37456d20', 1737220000000, 1737220000000);

-- Seed Contact (CRM Identity)
INSERT OR REPLACE INTO contact (id, workspaceId, name, email, role, status, archived, createdAt, updatedAt)
VALUES ('admin-id', 'ws-prod', 'Production Admin', 'admin@admin', 'superadmin', 'lead', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

