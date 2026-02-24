const toastEl = document.getElementById('toast');
let toastTimer;
function toast(msg, type = 'success') {
    toastEl.textContent = msg;
    toastEl.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 3000);
}

function updateNav() {
    const loggedIn = Auth.isLoggedIn();
    const user = Auth.getUser();
    document.querySelectorAll('.auth-only').forEach(el => el.classList.toggle('hidden', !loggedIn));
    document.querySelectorAll('.guest-only').forEach(el => el.classList.toggle('hidden', loggedIn));
    if (loggedIn && user) {
        const nameEl = document.getElementById('userNameText');
        if (nameEl) nameEl.textContent = user.userName || user.name || user.email?.split('@')[0] || 'User';
    }
    const route = location.hash.replace('#/', '') || 'home';
    document.querySelectorAll('.nav-link').forEach(a => {
        a.classList.toggle('active', !!a.dataset.page && route.startsWith(a.dataset.page));
    });
}

function posterEl(url, title, cls = 'movie-poster') {
    if (url && url.startsWith('http')) {
        return `<img src="${url}" alt="${title}" class="${cls}" loading="lazy" onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<div class=\\'poster-placeholder\\'>🎬</div>')" />`;
    }
    return `<div class="poster-placeholder">🎬</div>`;
}

function formatGenres(genresRaw) {
    try {
        const arr = JSON.parse(genresRaw || '[]');
        return arr.slice(0, 4).map(g => `<span class="genre-tag">${g.name || g}</span>`).join('');
    } catch { return genresRaw ? `<span class="genre-tag">${genresRaw}</span>` : ''; }
}

const STATUS_LABELS = { 'watching': 'Watching', 'completed': 'Completed', 'on-hold': 'On Hold', 'dropped': 'Dropped', 'plan-to-watch': 'Plan to Watch' };
function statusBadge(s) { return s ? `<span class="status-badge status-${s}">${STATUS_LABELS[s] || s}</span>` : ''; }

function renderUserScore(m) {
    const badge = statusBadge(m.status);
    const scoreText = m.score ? `<div class="score-inline">Your Score: ${m.score}/10</div>` : '';
    if (!badge && !scoreText) return '';
    return `<div style="margin-top:3px">${badge}${scoreText}</div>`;
}

function movieCard(m, favSet = new Set()) {
    const inList = favSet.has(m.id);
    const actionBtn = Auth.isLoggedIn()
        ? `<button class="card-add-btn ${inList ? 'in-list' : ''}" onclick="openListModal(event,${m.id},'${(m.title || '').replace(/'/g, "\\'")}',${inList})">${inList ? '✓ In List' : '+ Add to List'}</button>`
        : `<button class="card-add-btn" onclick="event.stopPropagation(); window.navigate('/login')">+ Add to List</button>`;

    return `
      <div class="movie-card" data-id="${m.id}">
        <div class="card-poster-wrap" onclick="navigate('/movie/${m.id}')">
          ${posterEl(m.posterUrl, m.title)}
        </div>
        <div class="movie-card-body" onclick="navigate('/movie/${m.id}')">
          <div class="movie-card-title" title="${m.title}">${m.title}</div>
          <div class="movie-card-meta">
            <span class="text-muted">${(m.releaseDate || '').slice(0, 4)}</span>
            ${m.voteAverage ? `<span class="rating-badge">★ ${Number(m.voteAverage).toFixed(1)}</span>` : ''}
          </div>
          ${inList && (m.status || m.score) ? renderUserScore(m) : ''}
          ${actionBtn}
        </div>
      </div>`;
}

function carouselHTML(id) {
    return `
      <div class="carousel-wrap">
        <div class="carousel-track" id="${id}"><div class="spinner"></div></div>
        <div class="carousel-nav">
          <button class="carousel-arrow" onclick="carouselScroll('${id}',-1)">&#8249;</button>
          <button class="carousel-arrow" onclick="carouselScroll('${id}',1)">&#8250;</button>
        </div>
      </div>`;
}

function carouselScroll(id, dir) {
    const track = document.getElementById(id);
    if (!track) return;
    const card = track.querySelector('.movie-card');
    if (!card) return;
    const cardW = card.offsetWidth + 16;
    track.scrollBy({ left: dir * cardW * 4, behavior: 'smooth' });
}
window.carouselScroll = carouselScroll;

async function getFavSet() {
    if (!Auth.isLoggedIn()) return new Set();
    try { const r = await request('GET', '/favorites'); return new Set((r.movies || []).map(m => m.id)); }
    catch { return new Set(); }
}
