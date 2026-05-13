(function () {
  const listEl = document.getElementById('templates-list');
  const draftsEl = document.getElementById('my-drafts-list');
  const form = document.getElementById('templateCreateForm');
  const noteEl = document.getElementById('tpl-form-note');
  const errEl = document.getElementById('tpl-error');
  const createBtn = document.getElementById('tpl-create-btn');
  const detailSection = document.getElementById('template-detail');
  const detailTitle = document.getElementById('detail-title');
  const detailMeta = document.getElementById('detail-meta');
  const detailDesc = document.getElementById('detail-desc');
  const detailTree = document.getElementById('detail-tree');
  const importBtn = document.getElementById('importTemplateBtn');
  const ratingStars = document.getElementById('templateRatingStars');
  const ratingSubmit = document.getElementById('submitTemplateRating');
  const ratingSummary = document.getElementById('template-rating-summary');

  let canPost = false;
  let selectedGoalId = null;

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showError(msg) {
    errEl.textContent = msg || '';
  }

  function getQueryId() {
    const id = Number(new URLSearchParams(window.location.search).get('id'));
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  async function loadAuth() {
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      if (!res.ok) {
        window.location.replace('login.html');
        return;
      }
      canPost = true;
      noteEl.textContent =
        'Creates a draft goal template. You will open the goal hub to add projects, milestones, and resources, then publish.';
    } catch (_) {
      window.location.replace('login.html');
      return;
    }
    createBtn.disabled = !canPost;
  }

  async function loadDrafts() {
    if (!canPost) {
      return;
    }
    const res = await fetch('/api/goal-templates/mine?state=draft', { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      draftsEl.innerHTML = '<p class="error">Could not load drafts.</p>';
      return;
    }
    const rows = data.results || [];
    if (!rows.length) {
      draftsEl.innerHTML = '<p style="color:var(--color-text-muted)">No drafts yet. Create one above.</p>';
      return;
    }
    draftsEl.innerHTML = rows
      .map(
        (g) => `
      <article class="card" style="padding:12px;margin-bottom:10px">
        <h3>${esc(g.title)}</h3>
        <p style="color:var(--color-text-muted);font-size:var(--font-size-sm)">Updated ${esc(String(g.updated_at || '').slice(0, 10))}</p>
        <a class="btn btn-secondary btn-sm" href="goal.html?id=${g.goal_id}">Open in goal hub</a>
      </article>`
      )
      .join('');
  }

  async function loadPublished() {
    listEl.innerHTML = '<p>Loading templates…</p>';
    const res = await fetch('/api/goal-templates', { credentials: 'include' });
    if (res.status === 401) {
      window.location.replace('login.html');
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      listEl.innerHTML = `<p class="error">${esc(data.error || 'Could not load templates.')}</p>`;
      return;
    }
    const rows = data.results || [];
    if (!rows.length) {
      listEl.innerHTML = '<p>No published goal templates yet.</p>';
      return;
    }
    listEl.innerHTML = rows
      .map(
        (g) => `
      <article class="card" style="padding:14px;margin-bottom:12px">
        <h3><a href="templates.html?id=${g.goal_id}">${esc(g.title)}</a></h3>
        <p style="color:var(--color-text-muted);margin:6px 0 8px">
          ${esc(g.category || 'general')} · by ${esc(g.author || '')} · copied ${g.template_copied_count || 0} times
          ${g.avg_rating != null ? ` · ★ ${Number(g.avg_rating).toFixed(1)} (${g.rating_count || 0})` : ''}
        </p>
        ${g.description ? `<p style="margin-bottom:10px">${esc(g.description)}</p>` : ''}
        <a class="btn btn-secondary btn-sm" href="templates.html?id=${g.goal_id}">View template</a>
      </article>`
      )
      .join('');
  }

  async function loadDetail(goalId) {
    selectedGoalId = goalId;
    detailSection.style.display = 'block';
    detailTree.innerHTML = '<p>Loading…</p>';
    ratingSummary.textContent = '';
    const res = await fetch(`/api/goal-templates/${goalId}`, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      detailSection.style.display = 'none';
      return;
    }
    const g = data.goal;
    detailTitle.textContent = g.title;
    detailMeta.textContent = `${g.category || 'general'} · by ${g.author || ''} · copied ${g.template_copied_count || 0}`;
    detailDesc.textContent = g.description || '';

    const projects = data.projects || [];
    const milestones = data.milestones || [];
    const msByProject = new Map();
    for (const m of milestones) {
      const arr = msByProject.get(m.project_id) || [];
      arr.push(m);
      msByProject.set(m.project_id, arr);
    }
    let treeHtml = '';
    for (const p of projects) {
      const ms = msByProject.get(p.project_id) || [];
      treeHtml += `<h4 style="margin:12px 0 6px">${esc(p.title)}</h4>`;
      treeHtml += ms.length
        ? `<ul>${ms.map((m) => `<li>${esc(m.title)}</li>`).join('')}</ul>`
        : '<p style="font-size:var(--font-size-sm);color:var(--color-text-muted)">No milestones</p>';
    }
    if (!projects.length) treeHtml = '<p style="color:var(--color-text-muted)">No projects in this template.</p>';
    const gr = data.goalResources || [];
    if (gr.length) {
      treeHtml += `<h4 style="margin:14px 0 6px">Goal-level resources</h4><ul>${gr
        .map((r) => `<li>${esc(r.title)}</li>`)
        .join('')}</ul>`;
    }
    detailTree.innerHTML = treeHtml;

    const rs = await fetch(`/api/goals/${goalId}/template-ratings`).catch(() => null);
    const rsData = rs ? await rs.json().catch(() => ({})) : {};
    if (rsData.success && rsData.avg_stars != null) {
      ratingSummary.textContent = `Average ${Number(rsData.avg_stars).toFixed(1)} (${rsData.count} ratings)`;
    } else {
      ratingSummary.textContent = 'No ratings yet.';
    }

    importBtn.style.display = canPost && g.template_kind === 'published' ? 'inline-block' : 'none';
    if (canPost && g.template_kind === 'published') {
      const meRes = await fetch('/api/me', { credentials: 'include' });
      const me = await meRes.json().catch(() => ({}));
      const uid = me.user && me.user.user_id;
      const isOwner = uid && Number(uid) === Number(g.user_id);
      importBtn.textContent = isOwner ? 'Duplicate into my goals' : 'Import into my goals';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!canPost) {
      showError('Please sign in.');
      return;
    }
    showError('');
    const title = document.getElementById('tpl-new-title').value.trim();
    const description = document.getElementById('tpl-new-desc').value.trim();
    const category = document.getElementById('tpl-new-cat').value.trim();
    if (title.length < 2) {
      showError('Title must be at least 2 characters.');
      return;
    }
    const res = await fetch('/api/goal-templates', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description: description || null, category: category || null })
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      showError('Session expired.');
      return;
    }
    if (!res.ok || !data.success) {
      showError(data.error || data.details?.join?.(', ') || 'Could not create template.');
      return;
    }
    window.location.href = `goal.html?id=${data.goal_id}`;
  });

  importBtn.addEventListener('click', async () => {
    if (!selectedGoalId || !canPost) return;
    if (!confirm('Create a new personal goal from this template? Projects, milestones, and resources will be copied.')) return;
    const res = await fetch(`/api/goal-templates/${selectedGoalId}/import`, {
      method: 'POST',
      credentials: 'include'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      alert(data.error || 'Import failed');
      return;
    }
    window.location.href = `goals.html?opened=${encodeURIComponent(String(data.goal_id))}`;
  });

  ratingSubmit.addEventListener('click', async () => {
    if (!selectedGoalId || !canPost) {
      alert('Sign in to rate.');
      return;
    }
    const stars = Number(ratingStars.value);
    if (!stars) {
      alert('Pick 1–5 stars.');
      return;
    }
    const res = await fetch(`/api/goals/${selectedGoalId}/template-rating`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stars })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      alert(data.error || 'Could not save rating');
      return;
    }
    const rs = await fetch(`/api/goals/${selectedGoalId}/template-ratings`);
    const rsData = await rs.json().catch(() => ({}));
    if (rsData.success && rsData.avg_stars != null) {
      ratingSummary.textContent = `Average ${Number(rsData.avg_stars).toFixed(1)} (${rsData.count} ratings)`;
    }
  });

  async function init() {
    await loadAuth();
    await loadDrafts();
    await loadPublished();
    const qid = getQueryId();
    if (qid) await loadDetail(qid);
    else detailSection.style.display = 'none';
  }

  init();
})();
