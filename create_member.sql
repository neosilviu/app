INSERT INTO user (id, name, email, role, workspaceId, status, createdAt, updatedAt)
VALUES ('user_member_1', 'Membru Test', 'member@test.ro', 'member', 'system', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO account (id, userId, accountId, providerId, password, createdAt, updatedAt)
VALUES ('account_member_1', 'user_member_1', 'member@test.ro', 'credential', '1cab33ff5573cddd2252ff0bf183f326:6e13f3bc3dd73594b50036448b1cc44d7eb0b7505d2b2998066f26a45a2d6c2792b63aa1fcb44e8aee4d7ca8be45f5004d6e15e20c31c0d4ea38fbbe1eb923a1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
