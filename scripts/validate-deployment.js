#!/usr/bin/env node

/**
 * Pre-deployment validation script
 * Ensures no dev code or dev config file are included in production bundles
 */

const fs = require('fs');
const path = require('path');

const CHECKS = {
    success: [],
    warnings: [],
    errors: []
};

function check(name, condition, message, isError = false) {
    if (condition) {
        CHECKS.success.push(`✓ ${name}`);
    } else {
        if (isError) {
            CHECKS.errors.push(`✗ ${name}: ${message}`);
        } else {
            CHECKS.warnings.push(`⚠ ${name}: ${message}`);
        }
    }
}

// 1. Check .env-dev is NOT in build (optional in dev, not required for deployment)
const envDevExists = fs.existsSync(path.join(__dirname, '../.dev/.env-dev'));
check(
    'Env file',
    envDevExists,
    '.env-dev should exist in .dev folder (dev only)',
    false
);

// 2. Check frontend build doesn't include .env-dev
const frontendBuildDir = path.join(__dirname, '../frontend/build');
if (fs.existsSync(frontendBuildDir)) {
    const buildEnvDev = fs.existsSync(path.join(frontendBuildDir, '.env-dev'));
    check(
        'Frontend build isolation',
        !buildEnvDev,
        'Frontend build should not contain .env-dev',
        true
    );
}

// 3. Check .env doesn't have dev-only variables
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    const devOnlyVars = [
        'DEV_MODE',
        'LOCALHOST',
        'DEV_SECONDARY_USER',
        'local_db_dev'
    ];
    
    const foundDevVars = devOnlyVars.filter(v => envContent.includes(v));
    check(
        'Production .env clean',
        foundDevVars.length === 0,
        `Found dev variables in .env: ${foundDevVars.join(', ')}`,
        true
    );
}

// 4. Check backend config doesn't have DEV_MODE references
const backendConfigPath = path.join(__dirname, '../backend/config.js');
if (fs.existsSync(backendConfigPath)) {
    const configContent = fs.readFileSync(backendConfigPath, 'utf8');
    const hasDevMode = configContent.includes('process.env.DEV_MODE');
    const hasDevCheck = configContent.includes("dev &&");
    
    check(
        'Backend config cleanup',
        !hasDevMode && !hasDevCheck,
        'Backend config should not reference DEV_MODE or dev conditionals',
        false
    );
}

// 5. Check API routes don't have hardcoded dev fallbacks (in backend)
const apiPath = path.join(__dirname, '../backend/lib/api.js');
if (fs.existsSync(apiPath)) {
    const apiContent = fs.readFileSync(apiPath, 'utf8');
    const hasFallbackUser = apiContent.includes("'dev-user'") || apiContent.includes('dev@studio.app');
    
    check(
        'API routes hardening',
        !hasFallbackUser,
        'API should not have dev fallback users',
        true
    );
}

// 6. Ensure dev-only route is NOT present
// Relaxed for React Router v7 as api.$.ts handles legitimate catch-all API requests
const devOnlyFile = path.join(__dirname, '../frontend/app/routes/dev-only.ts');
if (fs.existsSync(devOnlyFile)) {
    check(
        'Dev route exclusion',
        !fs.existsSync(devOnlyFile),
        'dev-only.ts should be removed before production deployment',
        true
    );
}

// Print results
console.log('\n=== DEPLOYMENT VALIDATION ===\n');

if (CHECKS.success.length > 0) {
    console.log('✓ PASSED:');
    CHECKS.success.forEach(msg => console.log(`  ${msg}`));
}

if (CHECKS.warnings.length > 0) {
    console.log('\n⚠ WARNINGS:');
    CHECKS.warnings.forEach(msg => console.log(`  ${msg}`));
}

if (CHECKS.errors.length > 0) {
    console.log('\n✗ ERRORS:');
    CHECKS.errors.forEach(msg => console.log(`  ${msg}`));
    console.log('\n❌ Deployment validation FAILED\n');
    process.exit(1);
}

console.log('\n✅ Deployment validation PASSED\n');
process.exit(0);

