/**
 * AXIOS MOCK - Simplified Fetch Bridge for Cloudflare Workers
 */

const axiosMock: any = async (config: any) => {
    const url = typeof config === 'string' ? config : config.url;
    const method = config.method || 'GET';
    const body = config.data ? JSON.stringify(config.data) : undefined;
    
    const res = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...config.headers
        },
        body
    });
    
    const data = await res.json().catch(() => null);
    
    return {
        data,
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        config
    };
};

axiosMock.create = () => axiosMock;
axiosMock.get = (url: string, config: any) => axiosMock({ ...config, url, method: 'GET' });
axiosMock.post = (url: string, data: any, config: any) => axiosMock({ ...config, url, data, method: 'POST' });
axiosMock.put = (url: string, data: any, config: any) => axiosMock({ ...config, url, data, method: 'PUT' });
axiosMock.delete = (url: string, config: any) => axiosMock({ ...config, url, method: 'DELETE' });

export default axiosMock;
