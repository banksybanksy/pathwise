/**
 * Why:
 *   So we can have a resusable navigation across all our pages and to handle for different
 *   representation depending on the user role
 *
 * What:
 *   It loads user authentication state, renders different markups depending on if guest
 *   or an actual verified user
 *
 * Where used:
 *   Will be loaded by all of our vertical-prototype/* pages before any of their specfic 
 *   scripts run
 *
 * Notes:
 *   - APIs it calls:
 *        /api/me
 *        /api/logout
 *   - To correctly work on each of its calling page a #nav-auth container is expected
 *     in its header.
 */

const navAuth = document.getElementById('nav-auth');
const currentPage = document.body.dataset.page || '';
const siteTitle = document.querySelector('.site-title');
const mainNav = document.getElementById('main-nav');
const headerInner = document.querySelector('.header-inner');

if (siteTitle) {
  siteTitle.setAttribute('href', 'landing.html');
}

// Grouping secondary pages keeps the signed-in navigation shorter and easier to scan.
function isWorkspacePage(page) {
  return ['dashboard', 'goals', 'goal-detail', 'templates', 'bookmarks', 'reflections', 'messages', 'admin', 'publish'].includes(page);
}

// Keep account-specific pages in their own smaller menu instead of mixing them with every feature link.
function isAccountPage(page) {
  return ['profile'].includes(page);
}

// Closing open popovers after navigation keeps the header from feeling cluttered.
function closeNavPopovers() {
  if (!mainNav) return;
  mainNav.querySelectorAll('.nav-popover[open]').forEach((popover) => {
    popover.removeAttribute('open');
  });
}

// Trimming the top row after login leaves only the most common paths visible.
function syncPrimaryNav(authenticated) {
  if (!mainNav) return;

  const submitLink = mainNav.querySelector('a[href="submit.html"]');
  if (submitLink) {
    submitLink.hidden = authenticated;
  }
}

// This toggle keeps the nav usable on phones without changing every HTML file by hand.
function setupMobileNav() {
  if (!mainNav || !headerInner) return;

  let navToggle = document.getElementById('nav-toggle');
  if (!navToggle) {
    navToggle = document.createElement('button');
    navToggle.type = 'button';
    navToggle.id = 'nav-toggle';
    navToggle.className = 'nav-toggle';
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Toggle navigation menu');
    navToggle.innerHTML = `
      <span class="nav-toggle__line"></span>
      <span class="nav-toggle__line"></span>
      <span class="nav-toggle__line"></span>
    `;
    headerInner.insertBefore(navToggle, mainNav);
  }

  const closeMobileNav = () => {
    mainNav.classList.remove('is-open');
    navToggle.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    closeNavPopovers();
  };

  if (!navToggle.dataset.bound) {
    navToggle.addEventListener('click', () => {
      const isOpen = mainNav.classList.toggle('is-open');
      navToggle.classList.toggle('is-open', isOpen);
      navToggle.setAttribute('aria-expanded', String(isOpen));
      if (!isOpen) {
        closeNavPopovers();
      }
    });
    navToggle.dataset.bound = 'true';
  }

  if (!mainNav.dataset.bound) {
    mainNav.addEventListener('click', (event) => {
      if (event.target.closest('a, button')) {
        closeMobileNav();
      }
    });
    mainNav.dataset.bound = 'true';
  }

  if (!window.__pathwiseMobileNavBound) {
    document.addEventListener('click', (event) => {
      if (mainNav && !mainNav.contains(event.target)) {
        closeNavPopovers();
      }
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        closeMobileNav();
      }
    });
    window.__pathwiseMobileNavBound = true;
  }
}

function guestNavMarkup() {
  return `
    <a href="login.html" class="nav-link"${currentPage === 'login' ? ' aria-current="page"' : ''}>Login</a>
    <a href="register.html" class="nav-btn"${currentPage === 'register' ? ' aria-current="page"' : ''}>Register</a>
  `;
}

// The signed-in nav now highlights only the main actions and tucks the rest into compact menus.
function authedNavMarkup(user) {
  const username = user.username || user.name || 'Account';
  const role = user.role || 'student';
  const adminLink =
    role === 'admin' || role === 'faculty' || role === 'staff'
      ? `<a href="admin.html" class="nav-popover__link${currentPage === 'admin' ? ' nav-popover__link--active' : ''}">Admin</a>`
      : '';
  const publishLink =
    role === 'faculty' || role === 'staff'
      ? `<a href="publish.html" class="nav-popover__link${currentPage === 'publish' ? ' nav-popover__link--active' : ''}">Publish</a>`
      : '';
  const workspaceActive = isWorkspacePage(currentPage) ? ' nav-summary--active' : '';
  const accountActive = isAccountPage(currentPage) ? ' nav-summary--active' : '';
  return `
    <details class="nav-popover">
      <summary class="nav-link nav-summary${workspaceActive}">Workspace</summary>
      <div class="nav-popover__panel">
        <a href="submit.html" class="nav-popover__link${currentPage === 'submit' ? ' nav-popover__link--active' : ''}">Submit Resource</a>
        <a href="dashboard.html" class="nav-popover__link${currentPage === 'dashboard' ? ' nav-popover__link--active' : ''}">Dashboard</a>
        <a href="goals.html" class="nav-popover__link${currentPage === 'goals' || currentPage === 'goal-detail' ? ' nav-popover__link--active' : ''}">Goals</a>
        <a href="templates.html" class="nav-popover__link${currentPage === 'templates' ? ' nav-popover__link--active' : ''}">Templates</a>
        <a href="bookmarks.html" class="nav-popover__link${currentPage === 'bookmarks' ? ' nav-popover__link--active' : ''}">Bookmarks</a>
        <a href="reflections.html" class="nav-popover__link${currentPage === 'reflections' ? ' nav-popover__link--active' : ''}">Reflections</a>
        <a href="messages.html" class="nav-popover__link${currentPage === 'messages' ? ' nav-popover__link--active' : ''}">Messages</a>
        ${adminLink}
        ${publishLink}
      </div>
    </details>
    <details class="nav-popover nav-popover--account">
      <summary class="nav-link nav-summary nav-summary--account${accountActive}">${username}</summary>
      <div class="nav-popover__panel">
        <a href="profile.html" class="nav-popover__link${currentPage === 'profile' ? ' nav-popover__link--active' : ''}">Profile</a>
        <button type="button" class="nav-popover__link nav-popover__button" id="logoutBtn">Logout</button>
      </div>
    </details>
  `;
}

function renderGuestNav() {
  if (!navAuth) return;
  navAuth.dataset.authState = 'guest';
  navAuth.innerHTML = guestNavMarkup();
  syncPrimaryNav(false);
  setupMobileNav();
}

function renderAuthedNav(user) {
  if (!navAuth) return;

  navAuth.dataset.authState = 'authenticated';
  navAuth.innerHTML = authedNavMarkup(user);
  syncPrimaryNav(true);
  setupMobileNav();

  const logoutBtn = document.getElementById('logoutBtn');
  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      if (!response.ok) throw new Error('Logout failed.');
      renderGuestNav();
      window.location.href = 'landing.html';
    } catch (error) {
      console.warn('Logout error:', error);
    }
  });
}

async function loadAuthState() {
  if (!navAuth) return;

  renderGuestNav(); // default to guest until /api/me responds

  try {
    const response = await fetch('/api/me', { credentials: 'include' });

    if (response.status === 401 || response.status === 404) return;
    if (!response.ok) throw new Error('Could not load auth state.');

    const data = await response.json();
    const user = data.user || data;

    if (!user || (!user.username && !user.name)) return;

    renderAuthedNav(user);
  } catch (error) {
    console.warn('Auth state unavailable:', error);
  }
}

loadAuthState();
