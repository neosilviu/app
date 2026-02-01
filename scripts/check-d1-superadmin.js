#!/usr/bin/env node

/**
 * Script to check superadmin credentials in Cloudflare D1
 * Interactive menu for selecting local vs production database
 */

const { execSync } = require('child_process');
const path = require('path');
const readline = require('readline');

// Color codes for terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let isRemote = true; // Default target

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function showMenu() {
  console.clear();
  const targetLabel = isRemote ? `${colors.red}PRODUCTION (Cloudflare)${colors.reset}` : `${colors.green}LOCAL (Development)${colors.reset}`;
  console.log(`
${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}
${colors.cyan}║${colors.reset}        🔐 Cloudflare D1 Maintenance Tool   ${colors.cyan}║${colors.reset}
${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}

${colors.bright}Current Target: ${targetLabel}${colors.reset}

${colors.bright}Meniu Administrator:${colors.reset}

  ${colors.green}[1]${colors.reset} 👤 ${colors.yellow}CHECK${colors.reset} SuperAdmin
  ${colors.green}[2]${colors.reset} 🔑 ${colors.yellow}CHANGE/RESET${colors.reset} SuperAdmin Password
  ${colors.green}[3]${colors.reset} 📊 ${colors.yellow}DIAGNOSTICS${colors.reset} (Count tables & integrity)
  ${colors.green}[4]${colors.reset} 🧹 ${colors.yellow}CLEANUP${colors.reset} Corrupted User
  ${colors.green}[5]${colors.reset} 🔄 ${colors.yellow}SWITCH TARGET${colors.reset} (Prod/Dev)
  ${colors.green}[6]${colors.reset} 📋 ${colors.yellow}ABOUT${colors.reset}
  ${colors.green}[0]${colors.reset} 🚪 ${colors.yellow}EXIT${colors.reset}

  `);
}

async function runD1Command(cmd, dbName = 'studio-db') {
  const flags = isRemote ? '--remote' : '--local';
  const result = execSync(`npx wrangler d1 execute ${dbName} ${flags} --command "${cmd.replace(/"/g, '\\"')}"`, {
    encoding: 'utf-8',
    cwd: path.join(__dirname, '../frontend'),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const lines = result.split('\n');
  let jsonStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('[')) {
      jsonStart = i;
      break;
    }
  }
  
  if (jsonStart >= 0) {
    return JSON.parse(lines.slice(jsonStart).join('\n'));
  }
  return null;
}

async function changePassword() {
  const targetName = isRemote ? 'Prod' : 'Dev';
  console.log(`\n${colors.bright}🔑 Modificare Parolă SuperAdmin (${targetName})${colors.reset}`);
  const email = await question(`Introduceți email superadmin: `);
  const newPass = await question(`Introduceti parola noua: `);

  if (!email || !newPass) {
    console.log(`${colors.red}Eroare: Email și parolă obligatorii!${colors.reset}`);
    await question('Apăsați Enter pentru a reveni...');
    return;
  }

  console.log(`\n${colors.yellow}⚠️  Sistemul folosește Better-Auth. Actualizarea manuală a parolei în DB este COMPLEXĂ deoarece necesită hash-uri scrypt corecte.${colors.reset}`);
  console.log(`${colors.yellow}Cea mai sigură metodă este ștergerea user-ului și re-crearea lui via /setup.${colors.reset}`);
  
  const confirm = await question(`Sigur doriți să ștergeți userul ${email} pentru re-creare? (y/n): `);
  if (confirm.toLowerCase() === 'y') {
    await cleanupUser(email);
  }
}

async function cleanupUser(targetEmail) {
  const email = targetEmail || await question(`Email user de șters: `);
  if (!email) return;

  const targetName = isRemote ? 'Prod' : 'Dev';
  const setupBase = isRemote ? 'https://service.aemdpc.ro' : 'http://localhost:5173';

  console.log(`\n🧹 Curățare date pentru ${email} (${targetName})...`);
  try {
    await runD1Command(`DELETE FROM session WHERE userId IN (SELECT id FROM user WHERE email = '${email}')`);
    await runD1Command(`DELETE FROM account WHERE userId IN (SELECT id FROM user WHERE email = '${email}')`);
    await runD1Command(`DELETE FROM user WHERE email = '${email}'`);
    await runD1Command(`DELETE FROM contact WHERE email = '${email}'`);
    console.log(`${colors.green}✓ User ${email} a fost șters cu succes din ${targetName}!${colors.reset}`);
    console.log(`${colors.bright}Acum poți merge la ${setupBase}/setup pentru a-l re-crea.${colors.reset}`);
  } catch (e) {
    console.error(`${colors.red}Eroare la ștergere: ${e.message}${colors.reset}`);
  }
  await question('\nApăsați Enter pentru a continua...');
}

async function runDiagnostics() {
  const targetName = isRemote ? 'Prod' : 'Dev';
  console.log(`\n📊 Diagnostice Bază de Date (${targetName})...\n`);
  try {
    const tables = await runD1Command("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    const tableList = tables[0]?.results || [];
    
    console.log(`${colors.bright}Structură DB:${colors.reset}`);
    console.log(`- Total Tabele: ${colors.green}${tableList.length}${colors.reset}`);
    
    const criticalTables = ['user', 'account', 'session', 'workspace', 'contact', 'system_setting'];
    for (const t of criticalTables) {
      const exists = tableList.some(ti => ti.name === t);
      console.log(`- Tabel ${t.padEnd(16)}: ${exists ? colors.green + 'OK' : colors.red + 'MIPSĂ'}${colors.reset}`);
    }

    const userCount = await runD1Command("SELECT COUNT(*) as count FROM user");
    console.log(`\n- Total Utilizatori: ${colors.green}${userCount[0]?.results[0]?.count || 0}${colors.reset}`);

    const settingsCount = await runD1Command("SELECT COUNT(*) as count FROM system_setting");
    console.log(`- Setări Registry:   ${colors.green}${settingsCount[0]?.results[0]?.count || 0}${colors.reset}`);

  } catch (e) {
    console.error(`${colors.red}Eroare diagnostice: ${e.message}${colors.reset}`);
  }
  await question('\nApăsați Enter pentru a reveni...');
}

async function checkSuperadmin(isRemote) {
  console.log('\n🔍 Se conectează la D1...\n');

  try {
    // Verify wrangler is installed
    try {
      execSync('npx wrangler --version', { stdio: 'pipe' });
    } catch (e) {
      console.error(`${colors.red}❌ Wrangler CLI not found${colors.reset}`);
      console.error('Install it with: npm install -g wrangler');
      await question('\nPress Enter to continue...');
      return;
    }

    const dbName = 'studio-db';
    let flags = '';
    let location = '';

    if (isRemote) {
      flags = '--remote';
      location = `${colors.red}PRODUCTION${colors.reset} (Cloudflare)`;
      console.log(`${colors.yellow}⚠️  Checking Cloudflare authentication...${colors.reset}\n`);
      try {
        execSync('npx wrangler whoami', {
          cwd: path.join(__dirname, '../frontend'),
          stdio: 'pipe',
        });
        console.log(`${colors.green}✓ Authenticated with Cloudflare${colors.reset}\n`);
      } catch (e) {
        console.error(`${colors.red}❌ Not authenticated with Cloudflare!${colors.reset}`);
        console.error(`\n${colors.yellow}Please login first:${colors.reset}`);
        console.error(`  ${colors.bright}wrangler login${colors.reset}`);
        console.error(`\nThen try again.\n`);
        await question(`${colors.yellow}Press Enter to return to menu...${colors.reset}`);
        return;
      }
    } else {
      flags = '--local';
      location = `${colors.green}LOCAL${colors.reset} (Development)`;
    }

    console.log(`📍 Accessing ${location} D1\n`);

    const sql = "SELECT id, email, name, role, createdAt, updatedAt FROM contact WHERE role = 'superadmin' LIMIT 1";

    let cmd;
    if (process.platform === 'win32') {
      const escapedSql = sql.replace(/"/g, '\\"');
      cmd = `npx wrangler d1 execute ${dbName} ${flags} --command "${escapedSql}"`;
    } else {
      cmd = `npx wrangler d1 execute ${dbName} ${flags} --command '${sql}'`;
    }

    console.log(`${colors.bright}Executing query...${colors.reset}\n`);

    const result = execSync(cmd, {
      encoding: 'utf-8',
      cwd: path.join(__dirname, '../frontend'),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Parse JSON output
    const lines = result.split('\n');
    let jsonStart = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('[')) {
        jsonStart = i;
        break;
      }
    }

    if (jsonStart >= 0) {
      const jsonStr = lines.slice(jsonStart).join('\n');
      const parsed = JSON.parse(jsonStr);

      if (parsed[0]?.results?.length > 0) {
        const user = parsed[0].results[0];

        console.log(
          `\n${colors.cyan}${'━'.repeat(60)}${colors.reset}`
        );
        console.log(
          `${colors.bright}${colors.green}👤 SUPERADMIN CREDENTIALS${colors.reset}`
        );
        console.log(
          `${colors.cyan}${'━'.repeat(60)}${colors.reset}\n`
        );
        console.log(`  ${colors.bright}📧 Email:${colors.reset}      ${colors.green}${user.email}${colors.reset}`);
        console.log(`  ${colors.bright}👤 Name:${colors.reset}       ${colors.green}${user.name}${colors.reset}`);
        console.log(`  ${colors.bright}🎯 Role:${colors.reset}       ${colors.green}${user.role}${colors.reset}`);
        console.log(`  ${colors.bright}🆔 User ID:${colors.reset}    ${colors.blue}${user.id}${colors.reset}`);
        console.log(`  ${colors.bright}📅 Created:${colors.reset}    ${user.createdAt || 'N/A'}`);
        console.log(`  ${colors.bright}📝 Updated:${colors.reset}    ${user.updatedAt || 'N/A'}`);
        console.log(`\n${colors.cyan}${'━'.repeat(60)}${colors.reset}\n`);
      } else {
        console.error(`${colors.red}❌ No superadmin user found${colors.reset}`);
      }
    }
  } catch (e) {
    const errorMsg = e.message || e.toString();
    const stderr = e.stderr ? e.stderr.toString() : '';
    const fullError = (errorMsg + stderr).substring(0, 500);

    console.error(`${colors.red}❌ Error:${colors.reset}\n`);
    
    // Detect error type and provide diagnostics
    const isNetworkError = errorMsg.includes('ENOTFOUND') || errorMsg.includes('connection') || errorMsg.includes('Failed to fetch');
    const isAuthError = errorMsg.includes('401') || errorMsg.includes('Unauthorized') || fullError.includes('unauthorized');
    const isPermissionError = errorMsg.includes('403') || fullError.includes('insufficient_permissions');
    const isSchemaError = errorMsg.includes('no such table') || fullError.includes('no such table');
    const isDbNotFound = errorMsg.includes('database not found') || fullError.includes('database not found');

    if (isNetworkError) {
      console.error(`${colors.yellow}Network Error${colors.reset} - Can't reach Cloudflare`);
      console.error(`\nRunning diagnostics...\n`);
      
      try {
        // Run automatic diagnostics
        const dFlags = isRemote ? '--remote' : '--local';
        console.log(`${colors.bright}1️⃣  Checking database info:${colors.reset}\n`);
        const dbInfo = execSync(`wrangler d1 info studio-db ${isRemote ? '--remote' : ''}`, {
          cwd: path.join(__dirname, '../frontend'),
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        console.log(dbInfo);

        console.log(`\n${colors.bright}2️⃣  Checking tables:${colors.reset}\n`);
        const tables = execSync(`wrangler d1 execute studio-db ${dFlags} --command "SELECT name FROM sqlite_master WHERE type='table';"`, {
          cwd: path.join(__dirname, '../frontend'),
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        console.log(tables);
      } catch (diagError) {
        console.error(`${colors.red}Diagnostics failed:${colors.reset}`, diagError.message.substring(0, 200));
      }
    } else if (isAuthError) {
      console.error(`${colors.yellow}Authentication Error${colors.reset}`);
      console.error(`\nYou need to login to Cloudflare first:`);
      console.error(`  ${colors.bright}wrangler login${colors.reset}`);
    } else if (isPermissionError) {
      console.error(`${colors.yellow}Permission Error${colors.reset}`);
      console.error(`\nYour Cloudflare account doesn't have access to this database.`);
    } else if (isSchemaError) {
      console.error(`${colors.yellow}Schema Not Found${colors.reset}`);
      console.error(`\nThe 'contact' table doesn't exist in this D1 database.`);
      console.error(`\nRun migrations:`);
      console.error(`  ${colors.bright}npm run db:migrate:remote${colors.reset}`);
    } else if (isDbNotFound) {
      console.error(`${colors.yellow}Database Not Found${colors.reset}`);
      console.error(`\nCan't find database 'studio-db' in your Cloudflare account.`);
      console.error(`\nTroubleshoot:`);
      console.error(`  1. List your D1 databases: ${colors.bright}wrangler d1 list${colors.reset}`);
      console.error(`  2. Check database info: ${colors.bright}wrangler d1 info studio-db --remote${colors.reset}`);
    } else {
      console.error(fullError);
    }

    console.log(`\n${colors.yellow}Quick Troubleshooting:${colors.reset}`);
    console.log(`  1. Check login status: ${colors.bright}wrangler whoami${colors.reset}`);
    console.log(`  2. Re-authenticate: ${colors.bright}wrangler login${colors.reset}`);
    console.log(`  3. List D1 databases: ${colors.bright}wrangler d1 list${colors.reset}`);
    console.log(`  4. Run migrations: ${colors.bright}npm run db:migrate:remote${colors.reset}}\n`);
  }

  await question(`${colors.yellow}Press Enter to return to menu...${colors.reset}`);
}

async function showAbout() {
  console.clear();
  console.log(`
${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}
${colors.cyan}║${colors.reset}                   ℹ️  ABOUT THIS TOOL ${colors.cyan}║${colors.reset}
${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}

${colors.bright}What is this?${colors.reset}
  This tool helps you retrieve superadmin credentials from your Cloudflare D1
  database. It supports both local development and production databases.

${colors.bright}Database Types:${colors.reset}
  ${colors.green}LOCAL${colors.reset}:       Development database on your machine
                 Path: .wrangler/v3/d1/
  
  ${colors.yellow}PRODUCTION${colors.reset}: Online Cloudflare D1 database
                 Requires: wrangler login

${colors.bright}Credentials:${colors.reset}
  Email:    admin@admin (local) or configured value (production)
  Password: Stored in plaintext in database
  Role:     'superadmin' role in contact table

${colors.bright}Security Note:${colors.reset}
  ${colors.red}⚠️  Keep these credentials safe!${colors.reset}
  Consider hashing passwords in production.

${colors.bright}Troubleshooting:${colors.reset}
  1. If production fails: run ${colors.bright}wrangler login${colors.reset}
  2. Check authentication: ${colors.bright}wrangler whoami${colors.reset}
  3. Verify database: ${colors.bright}wrangler d1 info studio-db${colors.reset}

  `);

  await question(`${colors.yellow}Press Enter to return to menu...${colors.reset}`);
}

async function main() {
  while (true) {
    await showMenu();
    const choice = await question(`${colors.bright}Introduceți opțiunea: ${colors.reset}`);

    switch (choice.trim()) {
      case '1':
        console.clear();
        await checkSuperadmin(isRemote);
        break;
      case '2':
        console.clear();
        await changePassword();
        break;
      case '3':
        console.clear();
        await runDiagnostics();
        break;
      case '4':
        console.clear();
        await cleanupUser();
        break;
      case '5':
        isRemote = !isRemote;
        const target = isRemote ? 'PRODUCTION' : 'LOCAL';
        console.log(`\n${colors.green}✓ Target schimbat la: ${target}${colors.reset}`);
        await new Promise(r => setTimeout(r, 800));
        break;
      case '6':
        await showAbout();
        break;
      case '0':
        console.log(`\n${colors.green}👋 Goodbye!${colors.reset}\n`);
        rl.close();
        process.exit(0);
      default:
        console.log(`${colors.red}Opțiune invalidă.${colors.reset}`);
        await question('Apasă Enter pentru a continua...');
    }
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}Exiting...${colors.reset}\n`);
  rl.close();
  process.exit(0);
});

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});



