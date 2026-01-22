# Exemplu Complet DNA Entitate (Enterprise Level 8)

Acesta este „Catalogul” complet de proprietăți pe care o entitate le poate avea în noul Registry (100% Registry-Driven & Multi-lang).

```json
{
  "id": "project_tasks",
  "label": { "ro": "Task Proiect", "en": "Project Task" },
  "labelPlural": { "ro": "Task-uri Proiecte", "en": "Project Tasks" },
  "icon": "CheckSquare",
  "colorTheme": "emerald",
  "tableName": "tasks",
  "displayField": "title",

  "features": {
    "softDelete": true,
    "auditable": true,
    "undo": true,
    "import": true,
    "export": true,
    "bulkActions": true,
    "attachments": true,
    "comments": true,
    "workflow": {
      "statusField": "status",
      "states": ["todo", "in_progress", "review", "done", "blocked"],
      "transitions": {
        "todo": ["in_progress"],
        "in_progress": ["review", "blocked"],
        "review": ["done", "todo"],
        "blocked": ["in_progress"]
      }
    }
  },

  "fields": {
    "title": {
      "type": "text",
      "label": { "ro": "Titlu Task", "en": "Task Title" },
      "required": true,
      "ui": { "width": 8, "placeholder": { "ro": "Ce trebuie făcut?", "en": "What needs to be done?" } }
    },
    "priority": {
      "type": "enum",
      "label": { "ro": "Prioritate", "en": "Priority" },
      "options": ["low", "medium", "high"],
      "ui": { "width": 4, "variant": "buttons" }
    },
    "status": {
      "type": "enum",
      "label": { "ro": "Status", "en": "Status" },
      "options": ["todo", "in_progress", "review", "done", "blocked"],
      "ui": { "width": 4 }
    },
    "assigned_to": {
      "type": "relation",
      "label": { "ro": "Responsabil", "en": "Assigned To" },
      "relation": { "target": "users", "field": "name" },
      "ui": { "width": 4 }
    },
    "deadline": {
      "type": "date",
      "label": { "ro": "Termen Limită", "en": "Deadline" },
      "visibility": {
        "type": "conditional",
        "dependsOn": "status",
        "operator": "==",
        "value": ["todo", "in_progress"]
      },
      "ui": { 
        "width": 4
      }
    },
    "auto_summary": {
      "type": "ai",
      "label": { "ro": "Rezumat AI", "en": "AI Summary" },
      "ai": {
        "prompt": "Fă un rezumat pentru task-ul {{title}} cu prioritatea {{priority}}.",
        "model": "smart"
      },
      "ui": { "width": 12 }
    },
    "total_cost": {
      "type": "formula",
      "label": { "ro": "Cost Total (TVA)", "en": "Total Cost (VAT)" },
      "formula": {
        "expression": "data.cost_estimat * 1.19"
      },
      "ui": { "width": 6 }
    },
    "description": {
      "type": "richtext",
      "label": { "ro": "Descriere Detaliată", "en": "Detailed Description" },
      "ui": { "width": 12 }
    },
    "client_contact": {
        "type": "phone",
        "label": { "ro": "Telefon Client", "en": "Client Phone" },
        "ui": {
            "width": 6,
            "actions": [
              { "type": "whatsapp", "label": { "ro": "Trimite Mesaj", "en": "Send Message" } }
            ]
        }
    }
  }
}
```

```json
{
  "id": "role",
  "label": { "ro": "Rol", "en": "Role" },
  "labelPlural": { "ro": "Roluri", "en": "Roles" },
  "icon": "Shield",
  "tableName": "role",
  "displayField": "name",
  "isSystem": true,

  "fields": {
    "id": { "type": "uuid", "primaryKey": true, "hidden": true },
    "workspaceId": { 
      "type": "relation", 
      "relation": { "target": "workspace", "field": "name" }, 
      "hidden": true 
    },
    "name": { 
      "type": "string", 
      "required": true, 
      "ui": { "width": 6, "icon": "Tag" } 
    },
    "color": { 
      "type": "color", 
      "ui": { "width": 6, "icon": "Palette" } 
    },
    "description": { 
      "type": "text", 
      "ui": { "width": 12 } 
    },
    "permissions": { 
      "type": "json", 
      "ui": { "width": 12, "helpText": "JSON array of permissions (e.g. ['*'] or ['contact:read'])" } 
    }
  },

  "menuConfig": {
    "showInMainMenu": true,
    "category": "administration",
    "icon": "Shield",
    "priority": 120
  }
}
```

## Note Arhitecturale v2
1. **Regula i18n**: Toate etichetele (`label`, `placeholder`, `description`) TREBUIE să fie obiecte `{ ro: string, en: string }`.
2. **Registry-Driven**: Baza de date (D1) este sincronizată automat. Orice câmp adăugat aici va declanșa un `ALTER TABLE` în Worker.
3. **Auto-Seed (Level 8)**: Când un tabel de sistem este definit în Registry, funcția `syncEntityTable` îl creează, iar `ensureBaselineSync` îl populează automat cu datele default din cod (`SYSTEM_ROLES`, `AI_PROMPTS` etc.).
4. **Audit & Undo**: Feature-ul `undo: true` permite rollback instant folosind `audit_logs` (snapshot-uri before/after).
5. **AI Integration**: Câmpurile de tip `ai` folosesc prompt-uri din registry care pot referenția alte câmpuri prin `{{fieldname}}`.

                {
                    "label": "WhatsApp",
                    "type": "whatsapp-trigger",
                    "icon": "MessageCircle",
                    "variant": "success",
                    "template": "Suntem la task-ul: {{title}}. Status: {{status}}."
                },
                {
                    "label": "Suna",
                    "type": "phone-call",
                    "icon": "Phone",
                    "variant": "primary"
                }
            ]
        }
    },
    "budget_impact": {
      "type": "currency",
      "label": "Cost Estimat",
      "currency": {
        "code": "RON",
        "decimals": 2
      },
      "ui": { 
        "width": 6, 
        "showIf": { "field": "priority", "operator": "eq", "value": "Urgent" }
      }
    },
    "ai_assistant": {
      "type": "ai-text",
      "label": "Sugestie AI",
      "ui": {
        "width": 12,
        "prompt": "Generați 3 sub-task-uri pentru: {{title}}",
        "variant": "ghost"
      }
    }
  },

  "menuConfig": {
    "showInMainMenu": true,
    "showInActionMenu": true,
    "category": "data_systems",
    "priority": 2,
    "badge": "count:status=Todo"
  },

  "permissions": {
    "roles": {
      "superadmin": ["*"],
      "admin": ["view", "add", "edit", "delete", "export"],
      "member": ["view", "add", "edit"]
    }
  },

  "dashboardConfig": {
    "enabled": true,
    "cards": [
      { "type": "count", "label": "Task-uri Active", "query": "WHERE status != 'Done'" },
      { "type": "chart", "label": "Distribuție Status", "query": "GROUP BY status" }
    ]
  },

  "layout": {
    "sections": [
      { "title": "Informații de Bază", "columns": 2, "fields": ["title", "priority"] },
      { "title": "Gestiune & Timp", "columns": 3, "fields": ["status", "assigned_to", "deadline"] },
      { "title": "Comunicare Client", "columns": 1, "variant": "glass", "fields": ["client_phone"] },
      { "title": "Conținut", "columns": 1, "fields": ["description", "ai_assistant"] }
    ]
  }
}
```
