-- Unified Initial Schema for Cloudflare D1
-- Organized by Functional Domains

-- ==========================================
-- 0. IDENTITY & AUTH (Better-Auth)
-- ==========================================

CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    emailVerified INTEGER DEFAULT 0,
    image TEXT,
    role TEXT DEFAULT 'user',
    permission TEXT, -- Level 8: Granular User Permissions
    preferredLanguage TEXT DEFAULT 'ro',
    lastWorkspaceId TEXT, -- Current workspace context
    status TEXT DEFAULT 'active',
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
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
    userId TEXT NOT NULL REFERENCES user(id)
);

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
    updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt INTEGER,
    updatedAt INTEGER
);

-- ==========================================
-- 1. CORE & SECURITY
-- ==========================================

-- 1. workspace
CREATE TABLE IF NOT EXISTS workspace (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT UNIQUE,
    ownerId TEXT REFERENCES user(id) ON DELETE SET NULL, -- Global User who owns it
    avatarUrl TEXT,
    settings TEXT, -- JSON for general settings
    status TEXT DEFAULT 'active',
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

CREATE INDEX IF NOT EXISTS idx_workspace_owner ON workspace(ownerId);

-- 2. contact (Unified Profile Table)
CREATE TABLE IF NOT EXISTS contact (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    userId TEXT REFERENCES user(id) ON DELETE SET NULL, -- Link to Auth User if applicable
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    position TEXT,
    type TEXT DEFAULT 'personal', -- personal, business, etc.
    role TEXT DEFAULT 'member', -- Individual role within context
    permission TEXT, -- Granular individual permissions
    avatarUrl TEXT,
    tag TEXT DEFAULT '[]', -- JSON array of tag IDs
    metadata TEXT DEFAULT '{}',
    status TEXT DEFAULT 'lead',
    last_interaction DATETIME,
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

CREATE INDEX IF NOT EXISTS idx_contact_workspace ON contact(workspaceId);
CREATE INDEX IF NOT EXISTS idx_contact_active ON contact(workspaceId) WHERE archived = 0;
CREATE INDEX IF NOT EXISTS idx_contact_email ON contact(email);
CREATE INDEX IF NOT EXISTS idx_contact_phone ON contact(phone);

-- 3. Workspace Users (Mapping)
CREATE TABLE IF NOT EXISTS workspace_user (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'user',
    permission TEXT, -- JSON array of granular permissions
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

CREATE INDEX IF NOT EXISTS idx_workspace_user_lookup ON workspace_user(workspaceId, userId);
CREATE INDEX IF NOT EXISTS idx_workspace_user_active ON workspace_user(workspaceId) WHERE archived = 0 AND deletedAt IS NULL;

-- 4. role
CREATE TABLE IF NOT EXISTS role (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL,
    name TEXT NOT NULL,
    permission TEXT, -- JSON
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME,
    FOREIGN KEY (workspaceId) REFERENCES workspace(id)
);

CREATE INDEX IF NOT EXISTS idx_role_workspace ON role(workspaceId);

-- 5. invitation
CREATE TABLE IF NOT EXISTS invitation (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    token TEXT UNIQUE NOT NULL,
    expiresAt DATETIME NOT NULL,
    status TEXT DEFAULT 'pending',
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME,
    FOREIGN KEY (workspaceId) REFERENCES workspace(id)
);

CREATE INDEX IF NOT EXISTS idx_invitation_workspace ON invitation(workspaceId);
CREATE INDEX IF NOT EXISTS idx_invitation_token ON invitation(token);

-- 6. Audit Logs (Level 8: Snapshots)
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
    snapshot_before TEXT, -- Added for Undo
    snapshot_after TEXT,  -- Added for Undo
    version INTEGER DEFAULT 1,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_workspace ON audit_log(workspaceId);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entityType, entityId);

-- ==========================================
-- 2. DYNAMIC CONFIGURATION & AI
-- ==========================================

-- 7. Entity Configuration (SSOT for UI)
CREATE TABLE IF NOT EXISTS _entity_config (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    label TEXT NOT NULL,
    collectionName TEXT NOT NULL,
    configJson TEXT NOT NULL,
    workspaceId TEXT DEFAULT 'system',
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

-- 8. Metadata (Dynamic Constants Override)
CREATE TABLE IF NOT EXISTS _metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI Metric
CREATE TABLE IF NOT EXISTS _ai_metric (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    duration INTEGER,
    success INTEGER,
    error TEXT,
    model TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_metric_workspace ON _ai_metric(workspaceId);

-- 9. AI Prompt Registry
CREATE TABLE IF NOT EXISTS _ai_prompt (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    systemPrompt TEXT NOT NULL,
    userPromptTemplate TEXT,
    model TEXT,
    inputContext TEXT, -- global, entity_list, etc.
    outputField TEXT,
    category TEXT, -- e.g., 'summarize', 'compose'
    workspaceId TEXT DEFAULT 'system',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

-- 10. Help Content Registry (AI Generated Support)
CREATE TABLE IF NOT EXISTS _help_content (
    id TEXT PRIMARY KEY, -- context/route/id
    title TEXT NOT NULL,
    content TEXT NOT NULL, -- Markdown AI generated
    category TEXT,
    isOfficial INTEGER DEFAULT 0,
    lastGenerated DATETIME,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. tag (Global Taxonomy)
CREATE TABLE IF NOT EXISTS tag (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    entityType TEXT,
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME,
    FOREIGN KEY (workspaceId) REFERENCES workspace(id)
);

CREATE INDEX IF NOT EXISTS idx_tag_workspace ON tag(workspaceId, entityType);

-- 12. Tag Assignments
CREATE TABLE IF NOT EXISTS tag_assignment (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL,
    tagId TEXT NOT NULL,
    entityType TEXT NOT NULL,
    entityId TEXT NOT NULL,
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME,
    FOREIGN KEY (tagId) REFERENCES tag(id)
);

-- Level 8: Polimorphic Attachments
CREATE TABLE IF NOT EXISTS entity_attachment (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    fileId TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
    entityType TEXT NOT NULL,
    entityId TEXT NOT NULL,
    category TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Level 8: Polimorphic Notes & Comments
CREATE TABLE IF NOT EXISTS entity_note (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    entityType TEXT NOT NULL,
    entityId TEXT NOT NULL,
    content TEXT NOT NULL,
    authorId TEXT REFERENCES contact(id) ON DELETE SET NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

CREATE INDEX IF NOT EXISTS idx_entity_note_target ON entity_note(entityType, entityId);
CREATE INDEX IF NOT EXISTS idx_entity_note_workspace ON entity_note(workspaceId);

CREATE INDEX IF NOT EXISTS idx_tag_assignment_lookup ON tag_assignment(entityId, entityType);
CREATE INDEX IF NOT EXISTS idx_tag_assignment_tag ON tag_assignment(tagId);

-- 13. System Settings (DEPRECATED - Use Level 8 Version below)
-- This table is handled by the dynamic engine later in the file.

-- ==========================================
-- 3. COMMUNICATION (CHAT & EMAIL)
-- ==========================================

-- 14. Conversation State (Unified Bot Control & Human-in-the-loop)
CREATE TABLE IF NOT EXISTS conversation_state (
    id TEXT PRIMARY KEY, -- format: provider:chatId (ex: whatsapp:407xxx)
    workspaceId TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'whatsapp', 'email'
    chatId TEXT NOT NULL,
    isBotEnabled INTEGER DEFAULT 1,
    lastHumanInteraction DATETIME,
    lastAutoReply DATETIME,
    metadata TEXT, -- JSON for extra state
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conv_state_lookup ON conversation_state(provider, chatId);

-- 15. WhatsApp Template (Mesaje Predefinite)
CREATE TABLE IF NOT EXISTS whatsapp_template (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT, -- 'vanzari', 'suport', etc.
    archived INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

CREATE INDEX IF NOT EXISTS idx_wa_template_workspace ON whatsapp_template(workspaceId);

-- 16. interaction (Unified Communications)
CREATE TABLE IF NOT EXISTS interaction (
    id TEXT PRIMARY KEY,
    workspaceId TEXT REFERENCES workspace(id) ON DELETE CASCADE,
    chatId TEXT,
    provider TEXT, -- 'whatsapp', 'email', 'gmail'
    body TEXT,
    bodyHtml TEXT,
    subject TEXT,
    status TEXT,
    flow_status TEXT DEFAULT 'new',
    fromMe INTEGER, -- 1 for outgoing, 0 for incoming
    remoteId TEXT,
    attachments TEXT, -- JSON
    labels TEXT, -- JSON
    metadata TEXT, -- JSON
    isPinned INTEGER DEFAULT 0,
    isFavorite INTEGER DEFAULT 0,
    isArchive INTEGER DEFAULT 0,
    isTrash INTEGER DEFAULT 0,
    readAt DATETIME,
    tag TEXT DEFAULT '[]', -- JSON array of tag IDs
    contentFetched INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

CREATE INDEX IF NOT EXISTS idx_interaction_chat ON interaction(chatId);
CREATE INDEX IF NOT EXISTS idx_interaction_chat_provider ON interaction(chatId, provider);
CREATE INDEX IF NOT EXISTS idx_interaction_provider ON interaction(provider);
CREATE INDEX IF NOT EXISTS idx_interaction_workspace ON interaction(workspaceId);
CREATE INDEX IF NOT EXISTS idx_interaction_pinned ON interaction(isPinned);
CREATE INDEX IF NOT EXISTS idx_interaction_fav ON interaction(isFavorite);
CREATE INDEX IF NOT EXISTS idx_interaction_archive ON interaction(isArchive);
CREATE INDEX IF NOT EXISTS idx_interaction_trash ON interaction(isTrash);

-- ==========================================
-- 4. file & STORAGE
-- ==========================================

-- 17. file
CREATE TABLE IF NOT EXISTS file (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    path TEXT NOT NULL,
    source TEXT,
    category TEXT,
    size INTEGER,
    metadata TEXT, -- JSON
    extracted INTEGER DEFAULT 0,
    extractedFiles TEXT, -- JSON
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

CREATE INDEX IF NOT EXISTS idx_file_workspace ON file(workspaceId);
CREATE INDEX IF NOT EXISTS idx_file_category ON file(category);
CREATE INDEX IF NOT EXISTS idx_file_active ON file(workspaceId) WHERE archived = 0 AND deletedAt IS NULL;

-- 18. Print Job
CREATE TABLE IF NOT EXISTS print_job (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    path TEXT NOT NULL,
    printerName TEXT,
    status TEXT DEFAULT 'pending',
    senderInfo TEXT, -- JSON
    copies INTEGER DEFAULT 1,
    isColor INTEGER DEFAULT 0,
    isDuplex INTEGER DEFAULT 0,
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

CREATE INDEX IF NOT EXISTS idx_print_job_active ON print_job(workspaceId) WHERE status = 'pending';

-- 19. Saved Print Queue
CREATE TABLE IF NOT EXISTS saved_print_queue (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    jobs TEXT, -- JSON
    contact TEXT, -- JSON
    createdBy TEXT, -- JSON
    status TEXT DEFAULT 'active',
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

-- ==========================================
-- 5. WORKFLOW & MONITORING
-- ==========================================

-- 20. task
CREATE TABLE IF NOT EXISTS task (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    contactId TEXT REFERENCES contact(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'medium',
    dueDate DATETIME,
    assignedTo TEXT,
    parentTaskId TEXT, -- For hierarchical subtasks
    progress INTEGER DEFAULT 0, -- For task completion tracking
    tag TEXT DEFAULT '[]', -- JSON array of tag IDs
    metadata TEXT DEFAULT '{}',
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME,
    FOREIGN KEY (parentTaskId) REFERENCES task(id)
);

CREATE INDEX IF NOT EXISTS idx_task_active ON task(workspaceId) WHERE archived = 0 AND deletedAt IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_status ON task(workspaceId, status);
CREATE INDEX IF NOT EXISTS idx_task_parent ON task(parentTaskId);
CREATE INDEX IF NOT EXISTS idx_task_workspace ON task(workspaceId);

-- 21. deal
CREATE TABLE IF NOT EXISTS deal (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    contactId TEXT REFERENCES contact(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    value REAL DEFAULT 0,
    currency TEXT DEFAULT 'RON',
    status TEXT DEFAULT 'open',
    source TEXT,
    tag TEXT DEFAULT '[]', -- JSON array of tag IDs
    metadata TEXT DEFAULT '{}',
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

CREATE INDEX IF NOT EXISTS idx_deal_workspace ON deal(workspaceId);
CREATE INDEX IF NOT EXISTS idx_deal_contact ON deal(contactId);

-- 22. lead
CREATE TABLE IF NOT EXISTS lead (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    contactId TEXT REFERENCES contact(id) ON DELETE SET NULL,
    source TEXT,
    status TEXT DEFAULT 'new',
    interestLevel TEXT,
    tag TEXT DEFAULT '[]', -- JSON array of tag IDs
    metadata TEXT DEFAULT '{}',
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

CREATE INDEX IF NOT EXISTS idx_lead_workspace ON lead(workspaceId);
CREATE INDEX IF NOT EXISTS idx_lead_contact ON lead(contactId);

-- 23. notification
CREATE TABLE IF NOT EXISTS notification (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info',
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'unread',
    metadata TEXT, -- JSON
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

CREATE INDEX IF NOT EXISTS idx_notification_workspace ON notification(workspaceId);
CREATE INDEX IF NOT EXISTS idx_notification_status ON notification(workspaceId, status);

-- 24. Bug Report
CREATE TABLE IF NOT EXISTS bug_report (
    id TEXT PRIMARY KEY,
    workspaceId TEXT REFERENCES workspace(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'new',
    priority TEXT DEFAULT 'medium',
    reported_by TEXT,
    metadata TEXT, -- JSON
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

CREATE INDEX IF NOT EXISTS idx_bug_report_workspace ON bug_report(workspaceId);
CREATE INDEX IF NOT EXISTS idx_bug_report_status ON bug_report(status);

-- 25. changelog
CREATE TABLE IF NOT EXISTS changelog (
    id TEXT PRIMARY KEY,
    module TEXT,
    version TEXT,
    title TEXT,
    description TEXT,
    type TEXT,
    date DATETIME,
    workspaceId TEXT REFERENCES workspace(id) ON DELETE CASCADE,
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

CREATE INDEX IF NOT EXISTS idx_changelog_module ON changelog(module);

-- 26. Workspace Setting (Metadata Store)
CREATE TABLE IF NOT EXISTS workspace_setting (
    id TEXT PRIMARY KEY, -- format: workspaceId:category or just workspaceId
    workspaceId TEXT REFERENCES workspace(id) ON DELETE CASCADE,
    category TEXT,
    settings TEXT, -- JSON
    workspaceName TEXT,
    timezone TEXT,
    logoUrl TEXT,
    language TEXT,
    ai TEXT, -- AI settings
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

-- 27. Workspace RBAC
CREATE TABLE IF NOT EXISTS workspace_rbac (
    id TEXT PRIMARY KEY, -- usually workspaceId
    workspaceId TEXT REFERENCES workspace(id) ON DELETE CASCADE,
    permission TEXT, -- JSON
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

-- 28. User Setting (Personal Preferences)
CREATE TABLE IF NOT EXISTS user_setting (
    id TEXT PRIMARY KEY, -- format: userId:category
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    settings TEXT NOT NULL, -- JSON
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

-- ==========================================
-- 27. DYNAMIC CONFIGURATION (No-Code Engine)
-- ==========================================

CREATE TABLE IF NOT EXISTS system_setting (
    id TEXT PRIMARY KEY,
    namespace TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    dataType TEXT DEFAULT 'text',
    description TEXT,
    isSecret INTEGER DEFAULT 0,
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME,
    UNIQUE(namespace, key)
);

-- Enterprise Level 8: Core Dynamics and Entities
-- This section defines the dynamic behavior of the app.

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
    fields TEXT NOT NULL, -- JSON
    validations TEXT, -- JSON
    relationships TEXT, -- JSON
    uiConfig TEXT, -- JSON
    menuConfig TEXT,
    permission TEXT, -- JSON
    features TEXT, -- JSON
    layout TEXT, -- JSON
    dashboardConfig TEXT, -- JSON
    isSystem INTEGER DEFAULT 0,
    workspaceId TEXT DEFAULT 'system',
    archived INTEGER DEFAULT 0,
    archivedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME,
    UNIQUE(name, workspaceId)
);

CREATE TABLE IF NOT EXISTS config_version (
    id TEXT PRIMARY KEY,
    namespace TEXT,
    configJson TEXT,
    changedBy TEXT,
    description TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME
);

-- Default Data from Migration 0002
INSERT OR IGNORE INTO _metadata (key, value, updatedAt) VALUES ('system_enums', '{"contactStatus":["lead","prospect","customer","archived"],"entityTypes":["contact","company","deal","task"],"priority":["low","medium","high","urgent"]}', CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO system_setting (id, namespace, key, value, dataType, updatedAt) VALUES ('ui_config', 'system', 'ui_config', '{"theme":"auto","sidebarCollapsed":false,"defaultLanguage":"ro"}', 'json', CURRENT_TIMESTAMP);
INSERT OR REPLACE INTO _metadata (key, value, updatedAt) VALUES ('db_version', '120', CURRENT_TIMESTAMP);
