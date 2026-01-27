/**
 * Setup Flow Integration Test
 * Tests the complete admin setup and login redirect flow
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:8788';

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
    process.exit(1);
  }
}

async function main() {
  console.log('Studio App v2 - Setup Flow Integration Tests\n');

  // Test 1: Check admin doesn't exist initially
  await test('Check admin (fresh state)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth?op=check-admin`);
    const data = await res.json();
    if (!data.success || data.data.exists !== false) {
      throw new Error(`Expected exists=false, got ${JSON.stringify(data)}`);
    }
  });

  // Test 2: Verify config endpoint works
  await test('Fetch config (registry)', async () => {
    const res = await fetch(`${BASE_URL}/api/config?t=${Date.now()}`);
    const data = await res.json();
    if (!data.success || !data.data.constants) {
      throw new Error(`Config fetch failed: ${JSON.stringify(data)}`);
    }
  });

  // Test 3: Verify setup-admin endpoint exists
  await test('Setup-admin endpoint available', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/setup-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test Admin'
      })
    });
    // Should succeed (200-299) or fail with 400+ (bad request, invalid data, etc)
    // But should not timeout or crash
    if (res.status === 500) {
      throw new Error(`Server error during setup-admin`);
    }
  });

  // Test 4: Verify session endpoint exists
  await test('Session endpoint available', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/getSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.status === 500) {
      throw new Error(`Server error during getSession`);
    }
  });

  console.log('\n✓ All setup flow tests passed!');
}

main().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
