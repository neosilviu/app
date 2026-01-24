/**
 * CORE HUB - Consolidated Library
 * Entry point for all shared logic in the Frontend.
 */

// 1. Registry & Bootstrap
export * from './registry';

// 2. Utilities
export * from './utils';
export type { NavItem } from './utils';
export { getLocalizedPath, getNavItemByPath, type EntityType } from './utils';

// 3. Data & DB
export {
    DB_UTILS,
    resolveCollection,
    getPrimaryKey,
    EntityParser,
    parseEntity,
    serializeEntity,
    getBrowserDb,
    type CachedConfig,
    type CachedData
} from './data';

// 4. Services (Socket, API, AI)
export {
    api,
    brainApi,
    localAgentApi,
    socket,
    whatsappSocket,
    socketRequest,
    getLocalAgentUrl,
    AiService,
    BaseAiEngine,
    PROMPT_MANAGER,
    CurrencyService
} from './services';

// 5. Auth
export {
    authClient
} from './auth';

// 6. Business Logic
export {
    BUSINESS_LOGIC,
    getTierPrice,
    calculateJobPrice,
    findTierPrice
} from './logic';

// 7. Entity Engine (Level 8)
export * from './entity-engine';


