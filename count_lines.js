const fs = require('fs');
const path = require('path');

function countLines(dir, extensions) {
    let totalLines = 0;
    let fileCount = 0;

    function walk(directory) {
        const file = fs.readdirSync(directory);
        for (const file of file) {
            const fullPath = path.join(directory, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                if (file !== 'node_modules' && file !== 'dist' && file !== 'build' && file !== '.git') {
                    walk(fullPath);
                }
            } else {
                const ext = path.extname(file);
                if (extensions.includes(ext)) {
                    try {
                        const content = fs.readFileSync(fullPath, 'utf-8');
                        const lines = content.split('\n').length;
                        totalLines += lines;
                        fileCount++;
                    } catch (e) {
                        // ignore binary or error
                    }
                }
            }
        }
    }

    if (fs.existsSync(dir)) {
        walk(dir);
    }
    return { totalLines, fileCount };
}

console.log('--- ANALYSIS ---');
const v1 = countLines('backend', ['.js', '.ts']);
console.log(`Backend V1 (Legacy): ${v1.totalLines} lines (${v1.fileCount} file)`);

const v2 = countLines('backend-v2', ['.ts']); // V2 is TS only mostly
console.log(`Backend V2 (New):    ${v2.totalLines} lines (${v2.fileCount} file)`);

