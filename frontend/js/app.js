const routes = { home: renderHome, discover: renderDiscover, mylist: renderMyList, login: renderLogin, register: renderRegister, movie: renderMovieDetail, random: renderRandom, stats: renderStats, about: renderAbout };

function navigate(path) { location.hash = '#' + path; }
window.navigate = navigate;
window.addEventListener('hashchange', router);
window.addEventListener('load', router);

function router() {
  updateNav();
  const hash = location.hash.replace('#/', '') || 'home';
  const [page, ...params] = hash.split('/');
  (routes[page] || renderHome)(...params);
}

let modalMovieId = null;
let modalStatus = null;
let modalScore = null;

function setupGridBtn(gridId, setter) {
  document.querySelectorAll(`#${gridId} .grid-btn`).forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll(`#${gridId} .grid-btn`).forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      setter(btn.dataset.val);
    });
  });
}

setupGridBtn('statusGrid', v => { modalStatus = v; });
setupGridBtn('scoreGrid', v => { modalScore = parseInt(v); });

function openListModal(e, movieId, title, isInList) {
  if (e) e.stopPropagation();
  if (!Auth.isLoggedIn()) { toast('Sign in to add to your list', 'error'); navigate('/login'); return; }
  modalMovieId = movieId;
  modalStatus = null;
  modalScore = null;
  document.getElementById('modalTitle').textContent = isInList ? `Edit: ${title}` : `Add: ${title}`;
  document.getElementById('modalRemoveBtn').style.display = isInList ? 'inline-block' : 'none';
  document.querySelectorAll('.grid-btn').forEach(b => b.classList.remove('selected'));

  if (isInList) {
    request('GET', `/favorites/${movieId}/check`).then(r => {
      if (r.status) {
        modalStatus = r.status;
        const sb = document.querySelector(`#statusGrid .grid-btn[data-val="${r.status}"]`);
        if (sb) sb.classList.add('selected');
      }
      if (r.score) {
        modalScore = r.score;
        const scb = document.querySelector(`#scoreGrid .grid-btn[data-val="${r.score}"]`);
        if (scb) scb.classList.add('selected');
      }
    }).catch(() => { });
  }
  document.getElementById('listModal').classList.add('active');
}
window.openListModal = openListModal;

function closeListModal() { document.getElementById('listModal').classList.remove('active'); modalMovieId = null; }
window.closeListModal = closeListModal;

document.getElementById('modalSaveBtn')?.addEventListener('click', async () => {
  if (!modalMovieId) return;
  try {
    await request('POST', '/favorites', { movieId: modalMovieId, status: modalStatus, score: modalScore });
    toast('Saved to your list!');
    closeListModal();
    const currentPage = location.hash.replace('#/', '').split('/')[0] || 'home';
    if (currentPage !== 'random') router();
  } catch (err) { toast(err.message, 'error'); }
});

document.getElementById('modalRemoveBtn')?.addEventListener('click', async () => {
  if (!modalMovieId) return;
  try {
    await request('DELETE', `/favorites/${modalMovieId}`);
    toast('Removed from list');
    closeListModal();
    const currentPage = location.hash.replace('#/', '').split('/')[0] || 'home';
    if (currentPage !== 'random') router();
  } catch (err) { toast(err.message, 'error'); }
});

document.getElementById('btnLogout')?.addEventListener('click', () => {
  Auth.clear(); updateNav(); toast('Signed out'); navigate('/home');
});

updateNav();
