async function renderHome() {
  app.innerHTML = `
      <div class="hero">
        <h1>Find your next<br><span>favourite movie</span></h1>
        <p>Browse thousands of movies, track what you watch and get personalised recommendations.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#/discover">Browse movies</a>
          <a class="btn btn-ghost" href="#/random">Random pick 🎲</a>
        </div>
      </div>

      <div class="section auth-only ${Auth.isLoggedIn() ? '' : 'hidden'}" id="personalSection">
        <div class="section-header"><h2>For You <span class="reco-badge">personalised</span></h2></div>
        ${carouselHTML('personalCarousel')}
      </div>

      <div class="section" id="popularSection">
        <div class="section-header"><h2>Recommendations for today</h2></div>
        ${carouselHTML('popularCarousel')}
      </div>
    `;
  loadPopular();
  if (Auth.isLoggedIn()) loadPersonalized();
}

async function loadPopular() {
  const track = document.getElementById('popularCarousel');
  if (!track) return;
  try {
    const r = await request('GET', '/recommendations/popular?limit=20');
    const favSet = await getFavSet();
    track.innerHTML = (r.movies || []).length
      ? (r.movies || []).map(m => movieCard(m, favSet)).join('')
      : '<div class="empty-state"><img src="assets/image.png" class="empty-image" alt="Empty" /><h3>No movies yet</h3></div>';
  } catch (err) { track.innerHTML = `<p class="text-muted">${err.message}</p>`; }
}

async function loadPersonalized() {
  const track = document.getElementById('personalCarousel');
  if (!track) return;
  try {
    const r = await request('GET', '/recommendations/personalized?limit=20');
    if (!r.personalized || !(r.movies || []).length) {
      track.innerHTML = '<div class="empty-state"><img src="assets/image.png" class="empty-image" alt="Empty" /><h3>Add movies to your list</h3><p class="text-muted">We\'ll recommend based on your taste</p></div>';
      return;
    }
    const favSet = await getFavSet();
    track.innerHTML = (r.movies || []).map(m => movieCard(m, favSet)).join('');
  } catch { }
}

async function loadGenreReco() {
  const track = document.getElementById('genreCarousel');
  const sel = document.getElementById('homeGenreSelect');
  if (!track || !sel) return;
  track.innerHTML = '<div class="spinner"></div>';
  try {
    const r = await request('GET', `/recommendations/genre?genre=${encodeURIComponent(sel.value)}&limit=20`);
    const favSet = await getFavSet();
    track.innerHTML = (r.movies || []).length
      ? (r.movies || []).map(m => movieCard(m, favSet)).join('')
      : '<div class="empty-state"><img src="assets/image.png" class="empty-image" alt="Empty" /><h3>No movies in this genre</h3></div>';
  } catch (err) { track.innerHTML = `<p class="text-muted">${err.message}</p>`; }
}
window.loadGenreReco = loadGenreReco;

let dPage = 1, dSearch = '', dGenre = '', dSort = 'popular';

async function renderDiscover() {
  app.innerHTML = `
      <div class="page-header"><h1>Discover</h1><p>Search and filter the full movie database</p></div>
      <div class="filter-bar">
        <input class="search-input" id="searchInput" type="text" placeholder="Search by title…" value="${dSearch}" />
        <select class="filter-select" id="genreFilter" onchange="applyFilters()">
          <option value="">All Genres</option>
          <option value="Action">Action</option><option value="Adventure">Adventure</option>
          <option value="Animation">Animation</option><option value="Comedy">Comedy</option>
          <option value="Crime">Crime</option><option value="Documentary">Documentary</option>
          <option value="Drama">Drama</option><option value="Family">Family</option>
          <option value="Fantasy">Fantasy</option><option value="History">History</option>
          <option value="Horror">Horror</option><option value="Music">Music</option>
          <option value="Mystery">Mystery</option><option value="Romance">Romance</option>
          <option value="Science Fiction">Sci-Fi</option><option value="Thriller">Thriller</option>
          <option value="War">War</option><option value="Western">Western</option>
        </select>
        <select class="filter-select" id="sortFilter" onchange="applyFilters()">
          <option value="popular">Most Popular</option>
          <option value="newest">Newest First</option>
        </select>
        <button class="btn btn-primary" onclick="doSearch()">Search</button>
      </div>
      <div class="movie-grid" id="discoverGrid"><div class="spinner"></div></div>
      <div class="pagination" id="paginationBar"></div>`;
  document.getElementById('searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  document.getElementById('genreFilter').value = dGenre;
  document.getElementById('sortFilter').value = dSort;
  loadDiscover();
}

function applyFilters() { dGenre = document.getElementById('genreFilter')?.value || ''; dSort = document.getElementById('sortFilter')?.value || 'popular'; dPage = 1; loadDiscover(); }
window.applyFilters = applyFilters;
function doSearch() { dSearch = document.getElementById('searchInput')?.value || ''; dPage = 1; loadDiscover(); }
window.doSearch = doSearch;
function goPage(p) { dPage = p; loadDiscover(); }
window.goPage = goPage;

async function loadDiscover() {
  const grid = document.getElementById('discoverGrid');
  if (grid) grid.innerHTML = '<div class="spinner"></div>';
  try {
    let qs = `page=${dPage}&limit=20`;
    if (dSearch) qs += `&search=${encodeURIComponent(dSearch)}`;
    if (dGenre) qs += `&genre=${encodeURIComponent(dGenre)}`;
    if (dSort) qs += `&sort=${dSort}`;
    const r = await request('GET', `/movies?${qs}`);
    const movies = r.movies || [];
    const pages = Math.ceil((r.total || movies.length) / 20);
    const favSet = await getFavSet();
    if (grid) grid.innerHTML = movies.length
      ? movies.map(m => movieCard(m, favSet)).join('')
      : '<div class="empty-state"><img src="assets/image.png" class="empty-image" alt="Empty" /><h3>No results</h3></div>';
    renderPagination(pages);
  } catch (err) { if (grid) grid.innerHTML = `<p class="text-muted">${err.message}</p>`; }
}

function renderPagination(pages) {
  const bar = document.getElementById('paginationBar');
  if (!bar || pages <= 1) { if (bar) bar.innerHTML = ''; return; }
  let html = '';
  if (dPage > 1) html += `<button class="page-btn" onclick="goPage(${dPage - 1})">←</button>`;
  const s = Math.max(1, dPage - 2), e = Math.min(pages, dPage + 2);
  for (let p = s; p <= e; p++) html += `<button class="page-btn${p === dPage ? ' active' : ''}" onclick="goPage(${p})">${p}</button>`;
  if (dPage < pages) html += `<button class="page-btn" onclick="goPage(${dPage + 1})">→</button>`;
  bar.innerHTML = html;
}

async function renderMyList() {
  if (!Auth.isLoggedIn()) { navigate('/login'); return; }
  app.innerHTML = `<div class="page-header" style="text-align:center"><h1>My List</h1><p>Movies you are tracking</p></div><div class="movie-grid" id="listGrid"><div class="spinner"></div></div>`;
  try {
    const r = await request('GET', '/favorites');
    const movies = r.movies || [];
    const favSet = new Set(movies.map(m => m.id));
    document.getElementById('listGrid').innerHTML = movies.length
      ? movies.map(m => movieCard(m, favSet)).join('')
      : '<div class="empty-state"><img src="assets/image.png" class="empty-image" alt="Empty" /></div>';
  } catch (err) { toast(err.message, 'error'); }
}

async function renderRandom() {
  app.innerHTML = `
      <div class="random-page">
        <div class="page-header" style="text-align:center">
          <h1>Random Pick 🎲</h1>
          <p>Not sure what to watch? Let us pick for you</p>
        </div>
        <div id="randomContainer"><div class="spinner"></div></div>
        <div style="text-align:center;margin-top:1.5rem">
          <button class="btn btn-primary btn-lg" onclick="reRoll()">🎲 Pick another one</button>
        </div>
      </div>`;
  loadRandom();
}

async function loadRandom() {
  const c = document.getElementById('randomContainer');
  if (!c) return;
  c.innerHTML = '<div class="spinner"></div>';
  try {
    const r = await request('GET', '/recommendations/random');
    const m = r.movie;
    if (!m) throw new Error('No movie found');

    let entry = null;
    const loggedIn = Auth.isLoggedIn();
    if (loggedIn) { try { entry = await request('GET', `/favorites/${m.id}/check`); } catch { } }
    const inList = entry?.isFavorite;

    c.innerHTML = `
        <div class="random-hero">
          <div class="random-poster-wrap">${posterEl(m.posterUrl, m.title, 'random-poster-img')}</div>
          <div class="random-info">
            <h2>${m.title}</h2>
            
            <div class="movie-metadata-grid">
              <div class="meta-col">
                ${m.overview ? `<h4 class="meta-label">SYNOPSIS</h4><p class="meta-value">${m.overview}</p>` : ''}
              </div>
              <div class="meta-col">
                ${m.releaseDate ? `<h4 class="meta-label">RELEASE DATE</h4><p class="meta-value">${m.releaseDate}</p>` : ''}
                <div class="meta-genres">${formatGenres(m.genres)}</div>
                ${m.voteAverage ? `<h4 class="meta-label">RATING</h4><p class="meta-value">★ ${Number(m.voteAverage).toFixed(1)} / 10</p>` : ''}
              </div>
            </div>

            ${inList && entry ? renderUserScore(entry) : ''}
            
            <div class="random-actions" style="margin-top:1.5rem">
              ${loggedIn
        ? `<button class="btn ${inList ? 'btn-outline' : 'btn-primary'}" onclick="openListModal(event,${m.id},'${(m.title || '').replace(/'/g, "\\'")}',${!!inList})">${inList ? '✏ Edit' : '+ Add to My List'}</button>`
        : `<a class="btn btn-outline" href="#/login">Sign in to track</a>`}
            </div>
          </div>
        </div>`;
  } catch (err) { c.innerHTML = `<div class="empty-state"><img src="assets/image.png" class="empty-image" alt="Error" /><h3>${err.message}</h3></div>`; }
}

function reRoll() { loadRandom(); }
window.reRoll = reRoll;

async function renderStats() {
  app.innerHTML = `<div class="page-header"><h1>Statistics</h1><p>Platform numbers at a glance</p></div><div id="statsContainer"><div class="spinner"></div></div>`;
  try {
    const s = await request('GET', '/movies/stats');
    document.getElementById('statsContainer').innerHTML = `
            <div class="stats-grid">
          <div class="stat-card"><div class="stat-value">${(s.totalMovies || 0).toLocaleString()}</div><div class="stat-label">Movies</div></div>
          <div class="stat-card"><div class="stat-value">${s.avgRating ? s.avgRating.toFixed(1) : '—'}</div><div class="stat-label">Platform Avg Rating</div></div>
          <div class="stat-card"><div class="stat-value">${(s.totalUsers || 0).toLocaleString()}</div><div class="stat-label">Users</div></div>
          <div class="stat-card"><div class="stat-value">${(s.totalFavorites || 0).toLocaleString()}</div><div class="stat-label">Movies Watched</div></div>
          ${Auth.isLoggedIn() ? `<div class="stat-card" style="border-color:var(--accent)"><div class="stat-value" style="color:var(--accent)">${s.userAvgRating ? s.userAvgRating.toFixed(1) : '—'}</div><div class="stat-label" style="color:var(--accent)">Your Avg Rating</div></div>` : ''}
        </div>
            ${Auth.isLoggedIn() ? `<div class="section"><div class="section-header"><h2>Your last watched movies</h2></div>${carouselHTML('statsCarousel')}</div>` : ''}`;

    if (Auth.isLoggedIn()) {
      loadStatsWatched();
    }
  } catch (err) { document.getElementById('statsContainer').innerHTML = `<p class="text-muted">${err.message}</p>`; }
}

async function loadStatsWatched() {
  const track = document.getElementById('statsCarousel');
  if (!track) return;
  try {
    const r = await request('GET', '/favorites');
    const favSet = await getFavSet();
    const watched = (r.movies || [])
      .filter(m => m.status === 'completed')
      .slice(0, 10);

    track.innerHTML = watched.length
      ? watched.map(m => movieCard(m, favSet)).join('')
      : '<div class="empty-state"><p class="text-muted">You haven\'t completed any movies yet.</p></div>';
  } catch { }
}

async function renderMovieDetail(id) {
  if (!id) { navigate('/discover'); return; }
  app.innerHTML = '<div class="spinner"></div>';
  try {
    const r = await request('GET', `/movies/${id}`);
    const m = r.movie || r;
    const loggedIn = Auth.isLoggedIn();
    let entry = null;
    if (loggedIn) { try { entry = await request('GET', `/favorites/${m.id}/check`); } catch { } }
    const inList = entry?.isFavorite;
    app.innerHTML = `
            <button class="btn btn-ghost btn-sm" style="margin-bottom:1rem" onclick="history.back()">← Back</button>
        <div class="movie-detail">
          <div class="detail-poster-wrap">${posterEl(m.posterUrl, m.title, 'detail-poster')}</div>
          <div class="detail-info">
            <h1>${m.title}</h1>
            
            <div class="movie-metadata-grid">
              <div class="meta-col">
                ${m.overview ? `<h4 class="meta-label">SYNOPSIS</h4><p class="meta-value">${m.overview}</p>` : ''}
              </div>
              <div class="meta-col">
                ${m.releaseDate ? `<h4 class="meta-label">RELEASE DATE</h4><p class="meta-value">${m.releaseDate}</p>` : ''}
                <div class="meta-genres">${formatGenres(m.genres)}</div>
                ${m.voteAverage ? `<h4 class="meta-label">RATING</h4><p class="meta-value">★ ${Number(m.voteAverage).toFixed(1)} / 10</p>` : ''}
              </div>
            </div>

            ${inList && entry ? renderUserScore(entry) : ''}
            <div class="detail-actions">
              ${loggedIn
        ? `<button class="btn ${inList ? 'btn-outline' : 'btn-primary'}" onclick="openListModal(event,${m.id},'${(m.title || '').replace(/'/g, "\\\\'")}',${!!inList})">${inList ? '✏ Edit' : '+ Add to My List'}</button>`
        : `<a class="btn btn-outline" href="#/login">Sign in to track</a>`}
            </div>
          </div>
        </div>
        <div class="section" style="margin-top:3rem">
          <div class="section-header"><h2>Similar Movies</h2></div>
          ${carouselHTML('similarCarousel')}
        </div>`;
    loadSimilarMovies(m.id);
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><div class="empty-icon">🎬</div><h3>Movie not found</h3><p>${err.message}</p></div>`;
  }
}

async function loadSimilarMovies(movieId) {
  const track = document.getElementById('similarCarousel');
  if (!track) return;
  try {
    const r = await request('GET', `/recommendations/movie/${movieId}?limit=10`);
    const favSet = await getFavSet();
    track.innerHTML = (r.movies || []).length
      ? (r.movies || []).map(m => movieCard(m, favSet)).join('')
      : '<div class="empty-state"><img src="assets/image.png" class="empty-image" alt="Empty" /><h3>No similar movies found</h3></div>';
  } catch {
    const track2 = document.getElementById('similarCarousel');
    if (track2) track2.innerHTML = '';
  }
}

function renderLogin() {
  if (Auth.isLoggedIn()) { navigate('/home'); return; }
  app.innerHTML = `
        <div class="auth-container"><div class="auth-card">
            <h2>Sign in</h2><p>Welcome back 👋</p>
            <div class="error-msg" id="loginErr"></div>
            <div class="form-group"><label>Email</label><input type="email" id="loginEmail" placeholder="you@example.com" /></div>
            <div class="form-group"><label>Password</label><input type="password" id="loginPass" placeholder="••••••" /></div>
            <button class="btn btn-primary form-submit" onclick="doLogin()">Sign in</button>
            <div class="form-footer">No account? <a href="#/register">Sign up</a></div>
        </div></div>`;
  document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPass').value;
  const err = document.getElementById('loginErr');
  err.style.display = 'none';
  try {
    const r = await request('POST', '/users/login', { email, password });
    Auth.set(r.token, r.user); updateNav(); navigate('/home');
  } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
}
window.doLogin = doLogin;

function renderRegister() {
  if (Auth.isLoggedIn()) { navigate('/home'); return; }
  app.innerHTML = `
        <div class="auth-container"><div class="auth-card">
            <h2>Create account</h2><p>Join MovieNest 🎬</p>
            <div class="error-msg" id="regErr"></div>
            <div class="form-group"><label>Name</label><input type="text" id="regName" placeholder="Your name" /></div>
            <div class="form-group"><label>Email</label><input type="email" id="regEmail" placeholder="you@example.com" /></div>
            <div class="form-group"><label>Password (min 6)</label><input type="password" id="regPass" placeholder="••••••" /></div>
            <button class="btn btn-primary form-submit" onclick="doRegister()">Sign up</button>
            <div class="form-footer">Have an account? <a href="#/login">Sign in</a></div>
        </div></div>`;
}

async function doRegister() {
  const userName = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPass').value;
  const err = document.getElementById('regErr');
  err.style.display = 'none';
  try {
    const r = await request('POST', '/users/register', { userName, email, password });
    Auth.set(r.token, r.user); updateNav(); toast('Account created!'); navigate('/home');
  } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
}
window.doRegister = doRegister;

function renderAbout() {
  app.innerHTML = `
        <div class="page-header"><h1>About MovieNest</h1></div>
        <div class="about-content">
            <p><strong>MovieNest</strong> is a student project built as part of a university course. It is a web application for recommending movies to users.</p>
            <h3>Features</h3>
            <ul>
                <li>Browse and search a database of ~5,000 movies from TMDB</li>
                <li>Create an account and track movies with statuses (Watching, Completed, etc.)</li>
                <li>Rate movies on a 1–10 scale</li>
                <li>Get personalised recommendations based on your list</li>
                <li>Explore movies by genre</li>
                <li>Random movie picker</li>
            </ul>
            <h3>Tech Stack</h3>
            <ul>
                <li><strong>Backend:</strong> Node.js, Express.js, Prisma ORM, SQLite</li>
                <li><strong>Frontend:</strong> Vanilla HTML, CSS, JavaScript (SPA)</li>
                <li><strong>Data:</strong> TMDB 5000 Movie Dataset</li>
            </ul>
            <h3>FAQ</h3>
            <p><strong>How are recommendations generated?</strong><br>
                Non-personalised recommendations show the highest-rated movies. Personalised recommendations analyse genres from your list and suggest similar top-rated movies you haven't added yet.</p>
            <p><strong>Can I use this without an account?</strong><br>
                Yes! Browse, search and filter without signing in. An account is only needed for tracking and personalised recommendations.</p>
        </div>`;
}
