export function loader() {
    return new Response("API Intercepted by entry.server.tsx Fast-Path.", { status: 200 });
}

export function action() {
    return new Response("API Intercepted by entry.server.tsx Fast-Path.", { status: 200 });
}

export default function ApiFallback() {
    return null;
}
