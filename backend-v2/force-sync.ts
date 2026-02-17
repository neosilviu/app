import { EntitySync } from './src/core/entity-sync';
import { DatabaseDriver } from './src/db/driver';
import { RegistryManager } from './src/core/registry';
import { SystemSchema } from './src/core/system-schema';

async function forceSync() {
  console.log("Starting force sync...");
  await DatabaseDriver.getInstance().connect();
  
  // 1.5 System Schema
  await SystemSchema.ensureTables();
  
  await RegistryManager.getInstance().load();
  const syncer = new EntitySync();
  await syncer.syncAll();
  console.log("Sync complete.");
  process.exit(0);
}

forceSync().catch(err => {
  console.error(err);
  process.exit(1);
});
