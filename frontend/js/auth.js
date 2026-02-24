const Auth = {
    getToken: () => localStorage.getItem('mn_token'),
    getUser: () => { try { return JSON.parse(localStorage.getItem('mn_user')); } catch { return null; } },
    isLoggedIn: () => !!localStorage.getItem('mn_token'),
    set(token, user) { localStorage.setItem('mn_token', token); localStorage.setItem('mn_user', JSON.stringify(user)); },
    clear() { localStorage.removeItem('mn_token'); localStorage.removeItem('mn_user'); },
};
