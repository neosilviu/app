import { Router } from 'express';
import fs from 'fs-extra';
import path from 'path';
import multer from 'multer';
import { DatabaseDriver } from '../../db/driver';
import { RegistryManager } from '../../core/registry';

const router = Router();
const db = DatabaseDriver.getInstance();

// Configure Multer for local storage
const uploadStorage = multer.diskStorage({
    destination: async (req: any, file: any, cb: any) => {
        const registry = RegistryManager.getInstance().get();
        const uploadPath = path.resolve(process.cwd(), registry.system?.local_inbox_path || './local-inbox');
        await fs.ensureDir(uploadPath);
        cb(null, uploadPath);
    },
    filename: (req: any, file: any, cb: any) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: uploadStorage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

/**
 * POST /api/file/upload
 * Handle local file uploads (Local Inbox)
 */
router.post('/upload', upload.single('file'), async (req: any, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const { workspaceId, userId, entityType, entityId } = req.body;
        
        const fileRecord = {
            id: crypto.randomUUID(),
            workspaceId: workspaceId || 'system',
            entity_type: entityType || 'local_upload',
            entity_id: entityId || 'none',
            file_name: req.file.originalname,
            file_path: req.file.path,
            size: req.file.size,
            mime_type: req.file.mimetype,
            createdAt: new Date().toISOString()
        };

        // Save to attachment table if it exists
        try {
            await db.query(`
                INSERT INTO entity_attachment (id, workspaceId, entity_type, entity_id, file_name, file_path, size, mime_type, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, Object.values(fileRecord));
        } catch (dbErr) {
            console.warn('[file] Failed to save attachment record to DB, but file was saved:', dbErr);
        }

        res.json({
            success: true,
            key: fileRecord.id,
            url: `/api/uploads/${path.basename(req.file.path)}`,
            name: fileRecord.file_name,
            size: fileRecord.size,
            type: fileRecord.mime_type
        });
    } catch (error: any) {
        console.error('[file] Upload error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Port logic from backend to use Registry
const getAllAllowedRoots = () => {
    const registry = RegistryManager.getInstance().get();
    const systemRoots = registry.system?.allowed_file_browser_roots || [];

    // Convert relative to absolute and resolve
    return systemRoots.map((r: string) => path.resolve(process.cwd(), r));
};

/**
 * GET /api/file/local/browser
 * List file in a local directory
 */
router.get('/local/browser', async (req, res) => {
    try {
        const registry = RegistryManager.getInstance().get();
        let requestedPath = (req.query.path as string) || '';
        let source = (req.query.source as string) || 'inbox';

        const inboxPath = path.resolve(process.cwd(), registry.system?.local_inbox_path || './local-inbox');
        const allowedRoots = getAllAllowedRoots();

        let baseDir = inboxPath;

        if (source !== 'inbox' && source !== 'auto') {
            baseDir = source;
        } else if (source === 'auto' || requestedPath.includes(':') || requestedPath.startsWith('\\\\')) {
             // If absolute path or auto source, allow if inside ANY allowed root
             const fullRequested = path.isAbsolute(requestedPath) ? requestedPath : path.resolve(requestedPath);
             const matchingRoot = allowedRoots.find((root: string) => {
                 return fullRequested.toLowerCase().startsWith(root.toLowerCase());
             });

             if (matchingRoot) {
                 baseDir = matchingRoot;
                 // Calculate relative path from this root if needed
                 if (path.isAbsolute(requestedPath)) {
                    requestedPath = path.relative(matchingRoot, requestedPath);
                 }
             } else if (source !== 'inbox') {
                 // If not in inbox and not matched, it's restricted
                 return res.status(403).json({ success: false, error: 'Path not in allowed roots' });
             }
        }

        const fullPath = path.resolve(baseDir, requestedPath);

        // Final security check: must be inside at least one allowed root (or inbox)
        const allPossibleRoots = [...allowedRoots, inboxPath];
        const isInsideAllowed = allPossibleRoots.some((root: string) => {
            const normalizedRoot = path.resolve(root).toLowerCase();
            const normalizedPath = fullPath.toLowerCase();
            return normalizedPath === normalizedRoot || normalizedPath.startsWith(normalizedRoot + path.sep) || normalizedPath.startsWith(normalizedRoot + '/');
        });

        if (!isInsideAllowed) {
            return res.status(403).json({ success: false, error: 'Access denied: Path outside allowed scope' });
        }

        if (!(await fs.pathExists(fullPath))) {
            return res.status(404).json({ success: false, error: 'Path not found' });
        }

        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
            const file = await fs.readdir(fullPath);
            const items = await Promise.all(file.map(async (f) => {
                const fPath = path.join(fullPath, f);
                try {
                    const fStats = await fs.stat(fPath);
                    return {
                        name: f,
                        isDirectory: fStats.isDirectory(),
                        size: fStats.size,
                        mtime: fStats.mtime,
                        ext: path.extname(f).toLowerCase(),
                        fullPath: fPath
                    };
                } catch (e) { return null; }
            }));

            const validItems = items.filter(i => i !== null) as any[];

            // Fetch tag for local file (ported logic)
            try {
                const paths = (validItems as any[]).map(i => i.fullPath);
                if (paths.length > 0) {
                    const placeholders = paths.map(() => '?').join(',');
                    const tagResults = await db.query(`
                        SELECT et.entityId as fullPath, t.id, t.name, t.color
                        FROM tag_assignment et
                        JOIN tag t ON et.tagId = t.id
                        WHERE et.entityType = 'local_file' AND et.entityId IN (${placeholders})
                    `, paths);

                    const tagMap: any = {};
                    (tagResults || []).forEach((tr: any) => {
                        if (!tagMap[tr.fullPath]) tagMap[tr.fullPath] = [];
                        tagMap[tr.fullPath].push({ id: tr.id, name: tr.name, color: tr.color });
                    });

                    (validItems as any[]).forEach(item => {
                        item.tag = tagMap[item.fullPath] || [];
                    });
                }
            } catch (tagErr) {
                console.error('[file] Failed to fetch tag for local file:', tagErr);
            }

            res.json({ success: true, isDirectory: true, items: validItems });
        } else {
            res.json({ success: true, isDirectory: false, size: stats.size, mtime: stats.mtime, fullPath });
        }
    } catch (error: any) {
        console.error('[file] Error browsing file:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export const filesRouter = router;


