#!/usr/bin/env node

/**
 * D1 Inspector Tool (Local & Remote)
 * List tables and view table content interactively for Cloudflare D1 (local or production)
 */

const { execSync } = require('child_process');
const path = require('path');
const readline = require('readline');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});


let isRemote = false; // Default: local
// DB config for local and remote (from wrangler.toml and wrangler.production.toml)
const LOCAL_DB_NAME = 'studio-db';
const REMOTE_DB_NAME = 'studio-db';
const REMOTE_DB_ID = '47d85050-d90c-4f91-93be-834f232652ca';

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

const ACCOUNT_ID = '1ee6235f1d9f54e97869e1620f5cb51e';

async function runD1Command(cmd) {
  let dbName = LOCAL_DB_NAME;
  let flags = '--local';
  const env = { ...process.env };
  
  if (isRemote) {
    dbName = REMOTE_DB_NAME;
    flags = `--remote`;
    env.CLOUDFLARE_ACCOUNT_ID = ACCOUNT_ID;
  }
  const wranglerCwd = path.join(__dirname, '../frontend');
  const wranglerCmd = `npx wrangler d1 execute ${dbName} ${flags} --command "${cmd.replace(/"/g, '\\"')}"`;
  console.log(`${colors.yellow}[DEBUG] cwd: ${wranglerCwd}${colors.reset}`);
  console.log(`${colors.yellow}[DEBUG] wrangler cmd: ${wranglerCmd}${colors.reset}`);
  const result = execSync(wranglerCmd, {
    encoding: 'utf-8',
    cwd: wranglerCwd,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  //console.log(`${colors.yellow}[DEBUG] wrangler raw output:\n${result}${colors.reset}`);
  // Try to parse JSON output (Cloudflare wrangler >=4 outputs JSON for d1 execute)
  const jsonStart = result.indexOf('[');
  if (jsonStart !== -1) {
    try {
      const jsonStr = result.slice(jsonStart);
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed) && parsed[0]?.results) {
        return parsed[0].results;
      }
    } catch (e) {
      // Fallback to ASCII table parsing
    }
  }
  // Fallback: Try to parse table output (old wrangler)
  const lines = result.split('\n');
  let start = lines.findIndex(l => l.trim().startsWith('|'));
  if (start >= 0) {
    // Table output, parse as array of objects
    const header = lines[start].split('|').map(s => s.trim()).filter(Boolean);
    const rows = [];
    for (let i = start + 2; i < lines.length; i++) {
      if (!lines[i].includes('|')) break;
      const cols = lines[i].split('|').map(s => s.trim());
      if (cols.length === header.length) {
        const obj = {};
        for (let j = 0; j < header.length; j++) obj[header[j]] = cols[j];
        rows.push(obj);
      }
    }
    return rows;
  }
  return result;
}

const fs = require('fs');

// Helper: Extract table names from migration SQL
function extractMigrationTables(migrationPath) {
  try {
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    // Regex: match CREATE TABLE IF NOT EXISTS table_name (
    const regex = /CREATE TABLE IF NOT EXISTS ([^\s(]+)/gi;
    const tables = [];
    let match;
    while ((match = regex.exec(sql)) !== null) {
      tables.push(match[1].replace(/[`'"]+/g, ''));
    }
    return tables;
  } catch (e) {
    return [];
  }
}

async function listTables() {
  const tables = await runD1Command("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
  // Migration file path (relative to this script)
  const migrationPath = path.join(__dirname, '../frontend/migrations/0001_initial.sql');
  const migrationTables = extractMigrationTables(migrationPath);
  const dbTableNames = Array.isArray(tables) ? tables.map(t => t.name) : [];

  // Show DB file path in DEV
  if (!isRemote) {
    // Caută recursiv fișierele DB locale doar în frontend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject
    const searchDir = path.join(__dirname, '../frontend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
    let foundFiles = [];
    function findAllDbFiles(dir) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findAllDbFiles(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.sqlite') || entry.name.endsWith('.sqlite3'))) {
          foundFiles.push({ path: fullPath, mtime: fs.statSync(fullPath).mtimeMs });
        }
      }
    }
    findAllDbFiles(searchDir);
    if (foundFiles.length > 0) {
      foundFiles.sort((a, b) => b.mtime - a.mtime);
      const dbFile = foundFiles[0].path;
      console.log(`\n${colors.bright}Calea DB locală:${colors.reset} ${colors.cyan}${dbFile}${colors.reset}`);
      console.log(`${colors.yellow}[DEBUG] DB file found: ${dbFile}${colors.reset}`);
    } else {
      console.log(`\n${colors.red}Nu am găsit fișierul DB local în .wrangler/state/v3/d1/miniflare-D1DatabaseObject${colors.reset}`);
    }
    // Debug: afișează și working directory
    console.log(`${colors.yellow}[DEBUG] Inspector working dir: ${process.cwd()}${colors.reset}`);
  }

  // Comparison
  const missing = migrationTables.filter(t => !dbTableNames.includes(t));
  const extra = dbTableNames.filter(t => !migrationTables.includes(t));

  console.log(`\n${colors.bright}Tabele disponibile:${colors.reset}`);
  dbTableNames.forEach(t => console.log('- ' + t));
  console.log(`\n${colors.cyan}Sumar:${colors.reset}`);
  console.log(`  In DB:     ${colors.green}${dbTableNames.length}${colors.reset}`);
  console.log(`  In migratie: ${colors.yellow}${migrationTables.length}${colors.reset}`);
  if (missing.length > 0) {
    console.log(`\n${colors.red}Lipsesc in DB (definite in migratie, dar nu exista in DB):${colors.reset}`);
    missing.forEach(t => console.log('  - ' + t));
  } else {
    console.log(`\n${colors.green}Toate tabelele din migratie exista in DB!${colors.reset}`);
  }
  if (extra.length > 0) {
    console.log(`\n${colors.yellow}Tabele extra in DB (nu sunt in migratie):${colors.reset}`);
    extra.forEach(t => console.log('  - ' + t));
  }
  await question('\nApăsați Enter pentru a reveni...');
}

async function showTableContent() {
  const tableName = await question('Introduceți numele tabelului: ');
  if (!tableName) return;
  const rows = await runD1Command(`SELECT * FROM ${tableName} LIMIT 50;`);
  console.log(`\n${colors.bright}Conținutul tabelului ${tableName}:${colors.reset}`);
  if (Array.isArray(rows)) {
    console.table(rows);
  } else {
    console.log(rows);
  }
  await question('\nApăsați Enter pentru a reveni...');
}

async function switchTarget() {
  isRemote = !isRemote;
  console.log(`\nTarget actual: ${isRemote ? colors.red + 'REMOTE (PROD)' + colors.reset : colors.green + 'LOCAL (DEV)' + colors.reset}`);
  await question('Apăsați Enter pentru a reveni la meniu...');
}

async function mainMenu() {
  while (true) {
    console.clear();
    console.log(`\n${colors.cyan}╔══════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.cyan}║${colors.reset}   D1 Inspector Tool (Local & Remote)           ${colors.cyan}║${colors.reset}`);
    console.log(`${colors.cyan}╚══════════════════════════════════════════════════════╝${colors.reset}`);
    console.log(`\nTarget: ${isRemote ? colors.red + 'REMOTE (PROD)' + colors.reset : colors.green + 'LOCAL (DEV)' + colors.reset}`);
    console.log(`\n${colors.bright}[1]${colors.reset} List Tables`);
    console.log(`${colors.bright}[2]${colors.reset} Show Table Content`);
    console.log(`${colors.bright}[3]${colors.reset} Switch Target (Local/Remote)`);
    console.log(`${colors.bright}[0]${colors.reset} Exit`);
    const opt = await question('\nAlegeți opțiunea: ');
    if (opt === '1') await listTables();
    else if (opt === '2') await showTableContent();
    else if (opt === '3') await switchTarget();
    else if (opt === '0') break;
  }
  rl.close();
}

mainMenu();
