async function request(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (Auth.isLoggedIn()) opts.headers['Authorization'] = `Bearer ${Auth.getToken()}`;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
}
