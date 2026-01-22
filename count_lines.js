const fs = require('fs');
const path = require('path');

function countLines(dir, extensions) {
    let totalLines = 0;
    let fileCount = 0;

    function walk(directory) {
        const files = fs.readdirSync(directory);
        for (const file of files) {
            const fullPath = path.join(directory, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                if (file !== 'node_modules' && file !== 'dist' && file !== 'build' && file !== '.git' && file !== '.dev' && file !== 'OLD') {
                    walk(fullPath);
                }
            } else {
                const ext = path.extname(file);
                if (extensions.includes(ext)) {
                    try {
                        const content = fs.readFileSync(fullPath, 'utf8');
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

console.log('--- STUDIO APP V2 - LINE COUNT ---');
const v2 = countLines('backend-v2/src', ['.ts', '.js']); 
console.log(`Backend V2 (Source):   ${String(v2.totalLines).padStart(7)} lines (${v2.fileCount} files)`);

const front = countLines('frontend/app', ['.ts', '.tsx', '.css']);
console.log(`Frontend (React):      ${String(front.totalLines).padStart(7)} lines (${front.fileCount} files)`);

const base = countLines('.', ['.ts']); // This will catch registry-baseline.ts
const baselineOnly = base.totalLines - v2.totalLines - (countLines('frontend', ['.ts']).totalLines); // Rough approx for root files
// Better: just count specifically registry-baseline.ts
const baseline = fs.readFileSync('registry-baseline.ts', 'utf8').split('\n').length;
console.log(`Registry Baseline:     ${String(baseline).padStart(7)} lines`);

const total = v2.totalLines + front.totalLines + baseline;
console.log('-----------------------------------');
console.log(`TOTAL CODE LINES:      ${String(total).padStart(7)}`);
console.log('-----------------------------------');

