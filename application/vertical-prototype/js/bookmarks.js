/**
 * Why:
 *   This file implements the bookmarks page so users can simply view the resources they 
 *   previously viewed and can also unsave them as well. Without this file the page would
 *   draw in useful information nor properly work as intended.
 *
 * What:
 *   This file fetches the saved resources for the current user, and renders each bookmark
 *   cards and show either empty, error or loading states as well as handle like mentioned
 *   above removing an alredy saved bookmarks for the user.
 *
 * Where used:
 *   It is loaded/called by vertical-prototype/bookmarks.html.
 *
 * Notes:
 *   - The APIs it calls: 
 *        /api/bookmarks.
 *   - As usual, we redirect user to the login.html on 401
 *   - It expects containers such as #bookmarks-results and #bookmark-count from
 *     bookmark html page to properly work 
 */

(async () => {
  const resultsEl = document.getElementById('bookmarks-results');
  const errorBanner = document.getElementById('bookmarks-error');
  const errorMsg = document.getElementById('bookmarks-error-msg');
  const countBadge = document.getElementById('bookmark-count');

  // Clear stale error state before each load attempt.
  errorBanner.hidden = true;
  errorMsg.textContent = '';

  // Show skeleton while fetching
  resultsEl.innerHTML = skeletonGrid();

  let bookmarks;
  try {
    const res = await fetch('/api/bookmarks', { credentials: 'include' });
    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Could not load bookmarks.');
    bookmarks = data.results ?? [];
    errorBanner.hidden = true;
    errorMsg.textContent = '';
  } catch (err) {
    resultsEl.innerHTML = '';
    errorMsg.textContent = err.message || 'Could not load bookmarks.';
    errorBanner.hidden = false;
    return;
  }

  if (bookmarks.length > 0) {
    countBadge.textContent = bookmarks.length;
    countBadge.hidden = false;
  }

  if (bookmarks.length === 0) {
    resultsEl.innerHTML = emptyState();
    return;
  }

  resultsEl.innerHTML = `<div class="bookmarks-grid">${bookmarks.map(buildCard).join('')}</div>`;

  resultsEl.querySelectorAll('.btn-unbookmark').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const resourceId = Number(btn.dataset.resourceId);
      btn.disabled = true;
      try {
        const res = await fetch('/api/bookmarks', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resource_id: resourceId, action: 'remove' }),
        });
        const json = await res.json();
        if (!json.success) throw new Error();
        btn.closest('.bookmark-card').remove();
        const remaining = resultsEl.querySelectorAll('.bookmark-card').length;
        if (remaining === 0) {
          resultsEl.innerHTML = emptyState();
          countBadge.hidden = true;
        } else {
          countBadge.textContent = remaining;
        }
      } catch {
        btn.disabled = false;
      }
    });
  });
})();

function buildCard(r) {
  const desc = r.description
    ? `<p class="bookmark-card-desc">${esc(r.description)}</p>`
    : '';
  return `
    <article class="bookmark-card">
      <h3 class="bookmark-card-title">
        <a href="${escAttr(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)}</a>
      </h3>
      ${desc}
      <div class="bookmark-card-footer">
        <span></span>
        <button class="btn-unbookmark" data-resource-id="${r.resource_id}"
                aria-label="Remove bookmark" title="Remove bookmark">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>
    </article>`;
}

function skeletonGrid() {
  const cards = Array.from({ length: 6 }, () => `
    <article class="bookmark-card bookmark-card--skeleton">
      <div class="skeleton-block skeleton-title"></div>
      <div class="skeleton-block skeleton-line"></div>
      <div class="skeleton-block skeleton-line skeleton-line--short"></div>
    </article>`).join('');
  return `<div class="bookmarks-grid">${cards}</div>`;
}

function emptyState() {
  return `
    <div class="bookmarks-empty">
      <div class="bookmarks-empty__icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" aria-hidden="true">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <p class="bookmarks-empty__title">No bookmarks yet</p>
      <p class="bookmarks-empty__subtitle">Save resources while browsing and they'll appear here.</p>
      <a href="index.html" class="btn btn-primary">Browse resources</a>
    </div>`;
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}
