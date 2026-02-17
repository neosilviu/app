/**
 * Safe environment variable accessor for both Node/Worker and Browser.
 */
export const safeEnv = (key: string, fallback: string = ''): string => {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key] || fallback;
    }
    return fallback;
};

export const isDevCheck = () => {
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') return true;
    const g = globalThis as any;
    if (typeof g.window !== 'undefined' && g.window.location) {
        const hostname = g.window.location.hostname;
        return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
    }
    return false;
};

export const isDev = isDevCheck();
