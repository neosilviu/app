/**
 * STUDIO APP v3 - JANITOR SCRIPT (Enterprise Level 10)
 * Scans the workspace for exported symbols (functions, constants, types) 
 * that are not referenced anywhere else in the project.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = process.cwd();
const SEARCH_DIRS = [
    path.join(ROOT_DIR, 'frontend', 'app'),
    path.join(ROOT_DIR, 'backend-v2', 'src'),
    path.join(ROOT_DIR, 'core'),
    path.join(ROOT_DIR, 'registry-baseline.ts')
];

const IGNORE_DIRS = ['node_modules', '.git', 'OLD', 'backups', 'build', 'dist', '.wrangler', '.react-router'];
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Symbols to ignore (common framework or system symbols)
const SYSTEM_SYMBOLS = [
    'loader', 'action', 'meta', 'default', 'clientLoader', 'clientAction',
    'ErrorBoundary', 'HydrateFallback', 'Layout', 'default'
];

/**
 * Recursively find files
 */
function getFiles(dir, allFiles = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const name = path.join(dir, file);
        if (IGNORE_DIRS.some(d => name.includes(`${path.sep}${d}${path.sep}`) || name.endsWith(`${path.sep}${d}`))) continue;
        
        if (fs.statSync(name).isDirectory()) {
            getFiles(name, allFiles);
        } else {
            if (EXTENSIONS.some(ext => name.endsWith(ext))) {
                allFiles.push(name);
            }
        }
    }
    return allFiles;
}

/**
 * Extract exported symbols from a file
 */
function extractExports(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const symbols = [];
    
    // Regex patterns for various exports
    const patterns = [
        /export\s+(?:const|let|var)\s+([a-zA-Z0-9_]+)/g,
        /export\s+function\s+([a-zA-Z0-9_]+)/g,
        /export\s+class\s+([a-zA-Z0-9_]+)/g,
        /export\s+type\s+([a-zA-Z0-9_]+)/g,
        /export\s+interface\s+([a-zA-Z0-9_]+)/g,
        /export\s+async\s+function\s+([a-zA-Z0-9_]+)/g
    ];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (match[1] && !SYSTEM_SYMBOLS.includes(match[1])) {
                symbols.push({
                    name: match[1],
                    file: filePath.replace(ROOT_DIR, '')
                });
            }
        }
    }

    return symbols;
}

/**
 * Check if a symbol is used in any file
 */
function isSymbolUsed(symbolName, allFiles) {
    // Escape for regex-like use in grep-like search
    // We search for the word with boundaries to avoid partial matches
    const searchPattern = `\\b${symbolName}\\b`;
    
    let count = 0;
    for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const regex = new RegExp(searchPattern, 'g');
        const matches = content.match(regex);
        if (matches) {
            count += matches.length;
        }
        // If count > 1 (declaration + usage), we can stop early for optimization if we want, 
        // but let's keep it simple for accurate reporting.
    }
    return count > 1; // 1 means only the definition exists
}

async function run() {
    console.log('🚀 [JANITOR] Starting Workspace Audit...');
    
    const allFiles = [];
    for (const dir of SEARCH_DIRS) {
        if (fs.existsSync(dir)) {
            if (fs.statSync(dir).isDirectory()) {
                getFiles(dir, allFiles);
            } else {
                allFiles.push(dir);
            }
        }
    }

    console.log(`📁 Found ${allFiles.length} files to scan.`);
    
    const allExports = [];
    for (const file of allFiles) {
        const exports = extractExports(file);
        allExports.push(...exports);
    }

    console.log(`🔍 Found ${allExports.length} exported symbols. Verifying usage...`);
    
    const unused = [];
    let processed = 0;

    for (const symbol of allExports) {
        processed++;
        if (processed % 50 === 0) {
            process.stdout.write(`⏳ Processed ${processed}/${allExports.length} symbols...\r`);
        }

        if (!isSymbolUsed(symbol.name, allFiles)) {
            unused.push(symbol);
        }
    }

    console.log('\n\n✅ Audit Complete!');
    console.log('-----------------------------------');
    
    if (unused.length === 0) {
        console.log('✨ No unused exports found! Project is clean.');
    } else {
        console.log(`⚠️  Found ${unused.length} potentially unused symbols:\n`);
        
        // Group by file for better readability
        const grouped = unused.reduce((acc, sym) => {
            acc[sym.file] = acc[sym.file] || [];
            acc[sym.file].push(sym.name);
            return acc;
        }, {});

        for (const [file, syms] of Object.entries(grouped)) {
            console.log(`📄 [${file}]`);
            syms.forEach(s => console.log(`   - ${s}`));
        }

        const reportPath = path.join(ROOT_DIR, 'unused_symbols_report.txt');
        fs.writeFileSync(reportPath, `STUDIO APP v2 - UNUSED SYMBOLS REPORT\nGenerated: ${new Date().toISOString()}\n\n` + 
            Object.entries(grouped).map(([file, syms]) => `[${file}]\n${syms.map(s => `  - ${s}`).join('\n')}`).join('\n\n'));
            
        console.log('\n-----------------------------------');
        console.log(`📝 Detailed report saved to: ${reportPath}`);
    }
}

run().catch(err => {
    console.error('❌ Audit failed:', err);
});
