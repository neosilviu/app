/**
 * BRAIN UTILS - Enterprise Level 8
 * Specialized data transformation and normalization helpers for the server.
 */

export const deepParse = (obj: any): any => {
    if (typeof obj === 'string' && (obj.startsWith('{') || obj.startsWith('['))) {
        try { return deepParse(JSON.parse(obj)); } catch { return obj; }
    }
    if (!obj || typeof obj !== 'object') return obj;
    const result = Array.isArray(obj) ? [...obj] : { ...obj };
    for (const key in result) result[key] = deepParse(result[key]);
    return result;
};

export const deepStringify = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    const result: any = Array.isArray(obj) ? [] : {};
    for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            try { result[k] = JSON.stringify(v); } catch { result[k] = v; }
        } else result[k] = v;
    }
    return result;
};

export const convertToCSV = (data: any[]): string => {
    if (!data || data.length === 0) {
        return "";
    }
    const headers = Object.keys(data[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));

    for (const row of data) {
        const values = headers.map(header => {
            let value = row[header];
            if (value === null || value === undefined) {
                value = '';
            } else if (typeof value === 'object') {
                value = JSON.stringify(value);
            }
            
            const stringValue = String(value);
            const escaped = stringValue.replace(/"/g, '""');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
};

/**
 * TRANSLATION TRANSFORMER - Enterprise Level 8
 * Converts multilingual fields (e.g. { ro: "...", en: "..." }) to a single value
 * based on the requested language, recursively through the entire response tree.
 */
export const transformTranslations = (obj: any, lang: string = 'ro'): any => {
    if (!obj) return obj;
    
    // Handle translation objects: { ro: 'text', en: 'text' }
    if (typeof obj === 'object' && !Array.isArray(obj) && 
        typeof obj[lang] === 'string' && 
        Object.keys(obj).every((k) => typeof obj[k] === 'string')) {
        return obj[lang] || obj['en'] || obj['ro'] || '';
    }
    
    // Recursively transform arrays
    if (Array.isArray(obj)) {
        return obj.map(item => transformTranslations(item, lang));
    }
    
    // Recursively transform objects
    if (typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = transformTranslations(value, lang);
        }
        return result;
    }
    
    return obj;
};

/**
 * UNIFIED API RESPONSE FORMAT (Enterprise Level 8)
 */
export const jsonHelper = (payload: any, status = 200) => Response.json(payload, { 
    status, 
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } 
});

export const successHelper = (data: any = true) => jsonHelper({ success: true, data });

export const errorHelper = (msg: string | Record<string, string>, status = 400, selectedLang = 'ro') => {
    let errorMsg = msg;
    if (typeof msg === 'object') {
        errorMsg = msg[selectedLang] || msg.en || msg.ro || JSON.stringify(msg);
    }
    return jsonHelper({ success: false, error: String(errorMsg) }, status);
};
