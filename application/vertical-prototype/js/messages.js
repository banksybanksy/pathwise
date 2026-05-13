/**
 * Why:
 *   It implements the messages page so users can talk amongst themselves one on one by
 *   searching to find other users, and opening each one-on-one threads to continue talking.
 *   Also, read new messages off inbox and send messages.
 *
 * What:
 *   This file loads inbox data, open an already exisitng message threds, as well as 
 *   handle user search and sending new messages just like a typcial simple messaging
 *   platforms.
 *
 * Where used:
 *   It is loaded/called by vertical-prototype/messages.html.
 *
 * Notes:
 *   - The APIs it calls: 
 *        /api/messages/inbox, 
 *        /api/messages/thread/:otherUserId,
 *        /api/messages, 
 *        /api/users/search, 
 *        /api/me.
 *   - As usual, we redirect user to the login.html on 401
 */

(function () {
  const inboxEl = document.getElementById('inbox-list');
  const threadEl = document.getElementById('thread-view');
  const errEl = document.getElementById('msg-error');
  const searchIn = document.getElementById('user-search');
  const suggestEl = document.getElementById('user-suggest');
  const toIdInput = document.getElementById('to-user-id');
  const toLabel = document.getElementById('to-user-label');
  const bodyIn = document.getElementById('msg-body');
  const sendBtn = document.getElementById('send-btn');

  let threadOtherId = null;
  let threadDisplayName = null;
  let currentUserId = null;

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function showErr(msg) {
    errEl.textContent = msg || '';
    errEl.hidden = !msg;
  }

  async function loadInbox() {
    const res = await fetch('/api/messages/inbox', { credentials: 'include' });
    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    const data = await res.json();
    if (!data.success) {
      inboxEl.innerHTML = '';
      showErr(data.error || 'Inbox failed');
      return;
    }
    const rows = data.results || [];
    if (rows.length === 0) {
      inboxEl.innerHTML = '<p class="profile-muted">No messages.</p>';
      return;
    }
    inboxEl.innerHTML = rows
      .map(
        (m) => `
      <button type="button" class="inbox-row" data-from="${m.from_user_id}" data-name="${esc(m.from_username)}"
        style="display:block;width:100%;text-align:left;padding:10px;margin-bottom:8px;border:1px solid var(--color-border);border-radius:8px;background:var(--color-surface);cursor:pointer">
        <strong>${esc(m.from_username)}</strong>
        <span style="color:var(--color-text-muted);font-size:0.85rem">${esc(String(m.created_at).slice(0, 16))}</span>
        <p style="margin:4px 0 0;font-size:0.9rem">${esc(m.body.slice(0, 120))}${m.body.length > 120 ? '…' : ''}</p>
      </button>`
      )
      .join('');

    inboxEl.querySelectorAll('.inbox-row').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-from'));
        const name = btn.getAttribute('data-name');
        openThread(id, name);
      });
    });
  }

  async function openThread(otherId, displayName) {
    threadOtherId = otherId;
    threadDisplayName = displayName || null;
    toIdInput.value = String(otherId);
    toLabel.textContent = displayName ? `Chat with ${displayName} (ID ${otherId})` : `User ID ${otherId}`;
    const res = await fetch(`/api/messages/thread/${otherId}`, { credentials: 'include' });
    const data = await res.json();
    if (!data.success) {
      threadEl.innerHTML = esc(data.error || 'Could not load thread');
      return;
    }
    const rows = data.results || [];
    threadEl.innerHTML = rows
      .map((m) => {
        const mine = currentUserId != null && String(m.from_user_id) === String(currentUserId);
        return `<div class="thread-bubble${mine ? ' thread-bubble--mine' : ''}" style="margin:8px 0;padding:8px 12px;border-radius:8px;background:${mine ? 'var(--color-primary-light)' : 'var(--color-background)'}">
          <p style="margin:0;font-size:0.85rem;color:var(--color-text-muted)">${esc(String(m.created_at).slice(0, 19))}</p>
          <p style="margin:4px 0 0">${esc(m.body)}</p>
        </div>`;
      })
      .join('');
  }

  searchIn.addEventListener(
    'input',
    debounce(async () => {
      const q = searchIn.value.trim();
      suggestEl.innerHTML = '';
      if (q.length < 2) return;
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { credentials: 'include' });
      const data = await res.json();
      if (!data.success || !data.results.length) return;
      suggestEl.innerHTML = data.results
        .map(
          (u) =>
            `<button type="button" class="btn btn-secondary btn-sm" style="margin:4px" data-uid="${u.user_id}" data-uname="${esc(u.username)}">${esc(u.username)}</button>`
        )
        .join('');
      suggestEl.querySelectorAll('button[data-uid]').forEach((b) => {
        b.addEventListener('click', () => {
          openThread(Number(b.getAttribute('data-uid')), b.getAttribute('data-uname'));
        });
      });
    }, 300)
  );

  sendBtn.addEventListener('click', async () => {
    const toId = parseInt(toIdInput.value, 10);
    const body = bodyIn.value.trim();
    if (!toId || !body) {
      showErr('Pick a recipient and enter a message.');
      return;
    }
    showErr('');
    const res = await fetch('/api/messages', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_user_id: toId, body })
    });
    const data = await res.json();
    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    if (!data.success) {
      showErr(data.error || 'Send failed');
      return;
    }
    bodyIn.value = '';
    await loadInbox();
    if (threadOtherId === toId) openThread(toId, threadDisplayName);
  });

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  (async function init() {
    const me = await fetch('/api/me', { credentials: 'include' });
    if (me.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    const meData = await me.json();
    if (meData.user) currentUserId = meData.user.user_id;
    loadInbox();
  })();
})();
