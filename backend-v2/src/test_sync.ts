import { EntitySync } from './core/entity-sync';
import { DatabaseDriver } from './db/driver';
import { RegistryManager } from './core/registry';
// import { AVAILABLE_V3_ENTITIES } from '../../core/entities/index'; // Eliminat: ESM import

(global as any).AVAILABLE_V3_ENTITIES = AVAILABLE_V3_ENTITIES;

async function test() {
    console.log("Starting Sync Test...");
    await DatabaseDriver.getInstance().connect();
    await RegistryManager.getInstance().load();
    const syncer = new EntitySync();
    await syncer.syncAll();
    console.log("Finished Sync Test.");
    process.exit(0);
}

test().catch(err => {
    console.error("Sync Error:", err);
    process.exit(1);
});
