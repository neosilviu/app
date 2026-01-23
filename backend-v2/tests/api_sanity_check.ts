import axios from 'axios';

const BASE_URL = 'http://localhost:4001/api/v2';

const color = {
    green: (text: string) => `\x1b[32m${text}\x1b[0m`,
    red: (text: string) => `\x1b[31m${text}\x1b[0m`,
    blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
};

async function runTest() {
    console.log(color.blue('🚀 Starting API Sanity Check for Backend V2...'));

    try {
        // 1. Check Registry
        console.log('1. Testing GET /registry/system...');
        const regRes = await axios.get(`${BASE_URL}/registry/system`);
        if (regRes.status === 200) {
            console.log(color.green(`   ✅ Success! Got registry keys`));
        } else {
            console.log(color.red(`   ❌ Failed: Status ${regRes.status}`));
        }

        // 2. Check Entities
        console.log('2. Testing GET /entity...');
        const entRes = await axios.get(`${BASE_URL}/entity`);
        if (entRes.status === 200 && entRes.data.success) {
            console.log(color.green(`   ✅ Success! Got entities list: ${entRes.data.data.map((e: any) => e.name).join(', ')}`));
        } else {
            console.log(color.red(`   ❌ Failed: Status ${entRes.status}`));
        }

        // 3. Check Audit Logs
        console.log('3. Testing GET /audit/log...');
        const audRes = await axios.get(`${BASE_URL}/audit/log`);
        if (audRes.status === 200 && audRes.data.success) {
            console.log(color.green(`   ✅ Success! Got ${audRes.data.count} logs`));
        } else {
            console.log(color.red(`   ❌ Failed: Status ${audRes.status}`));
        }

        console.log(color.blue('✨ Sanity Check Complete.'));

    } catch (error: any) {
        console.log(color.red(`🔥 Fatal Error: ${error.message}`));
        if (error.code === 'ECONNREFUSED') {
            console.log(color.red('   Is the server running on port 4001? (npm run dev)'));
        }
    }
}

runTest();
