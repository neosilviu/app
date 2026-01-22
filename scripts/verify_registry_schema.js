
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:8788/api';

async function verifySchemaDrift() {
    console.log("🛠️ Verificare Schema Drift & Integrity (Level 8)...");

    try {
        const response = await axios.get(`${API_URL}/config`);
        const { entities } = response.data.data;

        const checkTables = ['contact', 'interaction', 'audit_log', 'workspace'];
        
        console.log("\n📋 Analiză structură entități în Registru:");
        checkTables.forEach(tableName => {
            const config = entities[tableName];
            if (config) {
                const fieldNames = Object.keys(config.fields || {});
                console.log(`\n🔹 Entitate: ${tableName}`);
                console.log(`   - Câmpuri detectate: ${fieldNames.length}`);
                
                // Verificări specifice L8
                if (tableName === 'contact') {
                    if (fieldNames.includes('role')) console.log("   ✅ Câmp 'role' prezent (SSOT Sync)");
                    else console.error("   ❌ Câmp 'role' LIPSĂ!");
                }
                
                if (tableName === 'audit_log') {
                    if (fieldNames.includes('snapshot_before')) console.log("   ✅ Suport Snapshots (L8) prezent");
                    else console.error("   ❌ Suport Snapshots LIPSĂ!");
                }

                if (tableName === 'interaction') {
                    if (fieldNames.includes('flow_status')) console.log("   ✅ Suport Flow Status prezent");
                    else console.error("   ❌ Suport Flow Status LIPSĂ!");
                }
            } else {
                console.error(`❌ Entitatea ${tableName} nu este definită în Registru!`);
            }
        });

        console.log("\n🏁 Verificarea integrității schemei terminată.");
    } catch (error) {
        console.error("❌ Eroare la citirea configurației:", error.message);
    }
}

verifySchemaDrift();
