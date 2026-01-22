
const axios = require('axios');

// Configurări
const API_URL = process.env.API_URL || 'http://localhost:8788/api';
const API_KEY = process.env.API_KEY || 'dev-token';

async function checkRegistryHealth() {
    console.log("🚀 Pornire verificare Registry Health (v2)...");
    console.log(`🔗 URL: ${API_URL}`);

    try {
        // 1. Verificare config endpoint
        console.log("\n📦 Pas 1: Verificare endpoint /config...");
        const response = await axios.get(`${API_URL}/config`);
        const { data } = response;

        if (!data.success) {
            console.error("❌ Eroare: Endpoint-ul /config a returnat success: false");
            return;
        }

        const config = data.data;

        // 2. Verificare elemente obligatorii (Mandatory Blocks)
        const mandatoryBlocks = [
            { key: 'entities', label: 'Entity Configs (Tabel + Builder)' },
            { key: 'uiConfig', label: 'Theme & Brand' },
            { key: 'constants', label: 'App Constants' }
        ];

        console.log("\n🔍 Pas 2: Validare Blocuri Mandatory...");
        mandatoryBlocks.forEach(block => {
            if (config[block.key] && Object.keys(config[block.key]).length > 0) {
                console.log(`✅ ${block.label}: OK (${Object.keys(config[block.key]).length} elemente)`);
            } else {
                console.error(`❌ ${block.label}: LIPSĂ sau GOL!`);
            }
        });

        // 3. Verificare Sub-Sisteme (Nested Constants)
        const constants = config.constants || {};
        const subsystems = [
            { key: 'NAV', label: 'Navigație' },
            { key: 'AI_CONFIG', label: 'Configurație AI' },
            { key: 'AI_PROMPTS', label: 'Prompt-uri AI' },
            { key: 'RBAC', label: 'Roluri & Permisiuni' },
            { key: 'INTEGRATIONS', label: 'Integrări (WhatsApp/Mail)' }
        ];

        console.log("\n⚙️ Pas 3: Validare Sub-Sisteme Registry...");
        subsystems.forEach(sys => {
            if (constants[sys.key]) {
                console.log(`✅ ${sys.label}: OK`);
            } else {
                console.warn(`⚠️ ${sys.label}: Nu a fost găsit în constants (posibil fallback pe baseline)`);
            }
        });

        // 4. Verificare Brand & Theme Integrity
        console.log("\n🎨 Pas 4: Validare Brand Integrity...");
        const theme = config.uiConfig || {};
        const brand = theme.brand || {};
        if (brand.name && brand.primary) {
            console.log(`✅ Brand: ${brand.name} (${brand.primary})`);
        } else {
            console.error("❌ Brand-ul nu este configurat corect (lipsă nume sau culoare primară)!");
        }

        console.log("\n✨ Verificare finalizată cu succes!");

    } catch (error) {
        console.error("\n💥 EROARE FATALĂ la conectarea cu Brain:");
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(error.response.data);
        } else {
            console.error(error.message);
        }
    }
}

checkRegistryHealth();
