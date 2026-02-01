INSERT INTO task (id, workspaceId, contactId, title, description, status, priority, createdBy) 
VALUES ('task_parent_1', 'system', 'Ndq1FTzuUjFcryBuyR0Hx8KvrXN3yyDr', 'Proiect Implementare CRM', 'Task principal pentru testarea ierarhiei', 'pending', 'high', 'Ndq1FTzuUjFcryBuyR0Hx8KvrXN3yyDr');

INSERT INTO task (id, workspaceId, parentTaskId, title, description, status, priority, createdBy) 
VALUES ('task_child_1', 'system', 'task_parent_1', 'Configurare Registry', 'Subtask pentru setari initiale', 'pending', 'medium', 'Ndq1FTzuUjFcryBuyR0Hx8KvrXN3yyDr');

INSERT INTO interaction (id, workspaceId, contactId, channel, type, body, subject, fromMe, createdAt) 
VALUES ('int_1', 'system', 'Ndq1FTzuUjFcryBuyR0Hx8KvrXN3yyDr', 'whatsapp', 'inbound', 'Salut! Vreau sa testez noul timeline.', 'Test Timeline', 0, CURRENT_TIMESTAMP);

INSERT INTO interaction (id, workspaceId, contactId, channel, type, body, subject, fromMe, createdAt) 
VALUES ('int_2', 'system', 'Ndq1FTzuUjFcryBuyR0Hx8KvrXN3yyDr', 'whatsapp', 'outbound', 'Buna ziua! Functioneaza perfect.', 'Re: Test Timeline', 1, CURRENT_TIMESTAMP);

INSERT INTO interaction (id, workspaceId, contactId, channel, type, body, subject, fromMe, createdAt) 
VALUES ('int_3', 'system', 'Ndq1FTzuUjFcryBuyR0Hx8KvrXN3yyDr', 'email', 'inbound', 'Am trimis documentele solicitate pentru proiect.', 'Documente Proiect', 0, CURRENT_TIMESTAMP);
