/**
 * REGISTRY SYSTEM - SERVER SIDE
 * Lean & Mean version for the Brain
 */

import { REGISTRY_LITE } from './registry-lite';

export async function loadBaseline() {
    return REGISTRY_LITE;
}

export async function getRegistry(db?: any) {
    // This should match the signature of the client version
    // But we use the lite one.
    const { getRegistry: getLiteRegistry } = await import('./registry-lite');
    return getLiteRegistry(db);
}

export async function initializeRegistry() {
    return REGISTRY_LITE;
}

export function clearRegistryCache() {
    // No-op or clear internal cache if needed
}

export const REGISTRY_BASELINE = REGISTRY_LITE;
