# 🔧 Advanced Registry Editor - Complete Feature Guide

**Studio App v2** now includes a **fully-featured Registry Control Center** in the Superadmin Hub. This guide walks you through all capabilities.

---

## 📍 Location
**Route:** Superadmin Hub → "Global Registry" Tab
**Path:** `($lang)._app.superadmin.tsx` → Registry Tab Control

---

## ✨ Features Overview

### 1. **Live Registry Modification**
- ✅ Edit configuration values **without redeploy**
- ✅ Changes sync **instantly** across all connected clients
- ✅ Full history tracking of all modifications

### 2. **Search & Filter**
```
Search across:
- Registry key names (e.g., "DEAL_STATUS")
- Values inside arrays (e.g., "Pending", "Active")
- Descriptions and metadata
```

**Real-time filtering** - Start typing and results appear instantly.

### 3. **JSON Editor Mode**
For **complex objects** that aren't simple arrays:

```
Steps:
1. Click "JSON Editor" button on any registry key
2. Edit the JSON directly in the textarea
3. Validator catches syntax errors
4. Click "Save JSON" to persist

Example - Saving AI Config as JSON:
{
  "active_provider": "cloudflare",
  "model": "gpt-4-turbo",
  "temperature": 0.7,
  "providers": {
    "cloudflare": { "accountId": "...", "apiToken": "..." }
  }
}
```

### 4. **Change History & Audit Trail**
- **Last 50 changes** tracked in sidebar
- **Timestamp** for each modification
- **Before/After comparison** (click "View changes")
- **Automatic refresh** after each save

Example History Entry:
```
DEAL_STATUS
2:45:32 PM
- ["Pending", "Active", ...]
+ ["Pending", "Active", "Won", "Lost"]
```

### 5. **Array Item Management**
For array-based registries (most common):

```
Each item has:
- Label (display name)
- Value (internal identifier)
- Color (UI indicator/badge color)

Actions:
- Edit any field inline
- Delete items with trash icon
- Add new items with "+ Add Item"
- Save all changes with "Save Changes"
```

---

## 🎯 Use Cases

### Use Case 1: Add a New Deal Status
**Scenario:** User wants to add "Negotiating" status to deals.

1. Open **Registry** tab
2. Search for **"DEAL_STATUS"**
3. Click **"+ Add Item"**
4. Fill in:
   - Label: `Negotiating`
   - Value: `negotiating`
   - Color: `#F59E0B` (Amber)
5. Click **"Save Changes"**
6. ✅ Status appears in all Deal forms instantly!

### Use Case 2: Update AI Provider Configuration
**Scenario:** Need to switch from Gemini to Claude for AI architecture.

1. Open **Registry** tab
2. Search for **"AI_CONFIG"**
3. Click **"JSON Editor"**
4. Modify:
   ```json
   "active_provider": "claude"
   ```
5. Update API keys if needed
6. Click **"Save JSON"**
7. ✅ AI Architect now uses Claude!

### Use Case 3: Centralize Product Types
**Scenario:** Marketing wants to maintain their own list of product categories.

1. Open **Registry** tab
2. Click **"Add Registry Key"** (sidebar)
3. Type: `PRODUCT_CATEGORIES`
4. Click **"Create Key"**
5. Add items:
   - Software / software / #3B82F6
   - Hardware / hardware / #10B981
   - Services / services / #8B5CF6
6. In any form that needs product type:
   ```tsx
   <SelectField sourceRegistry="PRODUCT_CATEGORIES" />
   ```

---

## 🔄 Data Flow & Persistence

### Real-time Sync Mechanism:
```
Frontend (React) 
   ↓
Socket.emit('system:update-metadata', {key, value})
   ↓
Backend Handler (system.js)
   ↓
Database (_metadata table)
   ↓
io.emit('system:constants-updated') [Broadcast to all clients]
   ↓
All clients refresh via refreshConfig(true)
   ↓
UI updates instantly ⚡
```

### Database Storage:
- Table: `_metadata`
- Columns: `key`, `value` (JSON), `updatedAt`
- Key format: `UPPER_CASE_WITH_UNDERSCORES`
- Value: Stringified JSON (auto-parsed on load)

---

## 🛡️ Validation & Safety

### JSON Validation
- ✅ **Real-time syntax checking** in JSON editor
- ✅ **Error messages** if JSON is malformed
- ❌ **Blocks invalid JSON** from saving

### Type Safety
- Strings → stored as strings
- Numbers → stored as numbers
- Objects → stored as JSON
- Arrays → stored as JSON

### Rollback
- Change history shows before/after
- Manually revert by:
  1. Looking up old value in history
  2. Re-editing and saving correct value
  3. (Future: Automated undo button)

---

## 📊 Statistics & Monitoring

**Registry Stats Bar:**
- `X Categories` - Total number of registry keys
- `Y Changes` - Edit history count

**Search Results:**
- Shows only matching keys
- Live as you type
- Reset by clearing search field

---

## 🚀 Advanced Usage

### Programmatic Access in Code:
```tsx
import { useConfig } from '~/hooks/useConfig';

function MyComponent() {
  const { constants } = useConfig();
  
  // Access any registry key dynamically
  const dealStatuses = constants.DEAL_STATUS || [];
  const aiConfig = constants.AI_CONFIG || {};
  
  return (
    <Select options={dealStatuses} />
  );
}
```

### Register New Keys from Code:
```typescript
// In superadmin, create a new registry key
socket.emit('system:update-metadata', {
  key: 'MY_CUSTOM_ENUM',
  value: [
    { label: 'Option 1', value: 'opt1', color: '#...' },
    { label: 'Option 2', value: 'opt2', color: '#...' }
  ]
}, (res) => {
  if (res.success) console.log('Registry key created!');
});
```

---

## ⚠️ Common Pitfalls

| Issue | Solution |
|-------|----------|
| Changes not visible | Click **Refresh** button or reload browser |
| JSON won't save | Check for syntax errors (missing commas, quotes) |
| Value not found in useConfig | Verify key name matches exactly (case-sensitive) |
| History not showing | History tracks edits within session (max 50) |
| Delete doesn't work | Click item trash icon, then "Save Changes" |

---

## 🔐 Permissions

- **Superadmin:** Full access (read, write, delete)
- **Admin:** Read-only (view registry values)
- **User:** No access to registry editor

(Configure in `global-registry.baseline.js` → `ROLES`)

---

## 📝 Migration Path

### Moving from Hardcoded to Registry:

**Before (Hardcoded):**
```tsx
const statuses = ['Pending', 'Active', 'Done'];
```

**After (Registry-Driven):**
```tsx
const { constants } = useConfig();
const statuses = constants.DEAL_STATUS?.map(s => s.label);
```

Benefits:
- ✅ No code changes for config updates
- ✅ Non-technical users can manage values
- ✅ A/B testing different configurations
- ✅ Instant rollback if something breaks

---

## 🎓 Summary

The **Registry Editor** transforms your app from **code-driven** to **config-driven**:
- 🚀 Faster iterations
- 👥 Empowers non-developers
- 🔄 Zero-downtime updates
- 📊 Complete audit trail

For questions or bugs, refer to `/app/backend/lib/socket/handlers/system.js` and `/app/frontend/app/routes/($lang)._app.superadmin.tsx`.

---

**Last Updated:** January 15, 2026
**Maintained by:** AI Architect
