/**
 * Why:
 *   This file implements the goal page (aka. Goal Hub page) where a user can manage a goal
 *   in detail like its projects and milestones. This is needed so we create a clean sepration
 *   between the main aggregate goals layer and the actual specific goal layer.
 *
 * What:
 *   It fetches goal hub data and renders projects/milestone lists. It also handles create,
 *   read, update and delete operations for the projects and milestones within each project
 *   as well as status markers for each of these components.
 *
 * Where used:
 *   It is loaded/called by vertical-prototype/goal.html.
 *
 * Notes:
 *   - The APIs it call: 
 *        /api/goals/:id/hub, 
 *        /api/goals/:id/projects,
 *        /api/projects/:id, 
 *        /api/projects/:projectId/milestones,
 *        /api/milestones/:id, 
 *        /api/milestones/:id/completion.
 *   - As usual, we redirect user to the login.html on 401
 */

(function () {
  const params = new URLSearchParams(window.location.search);
  const goalId = Number(params.get('id'));
  const root = document.getElementById('goal-detail-root');
  const errEl = document.getElementById('goal-page-error');

  function showErr(msg) {
    errEl.textContent = msg || '';
    errEl.hidden = !msg;
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  // Reuse one loading shell so refreshes feel smoother after project and milestone edits.
  function detailLoadingMarkup() {
    return `
      <section class="card goal-detail-loading__card">
        <div class="goal-skeleton-block goal-skeleton-title"></div>
        <div class="goal-skeleton-block goal-skeleton-meta"></div>
        <div class="goal-skeleton-block goal-skeleton-line"></div>
        <div class="goal-skeleton-block goal-skeleton-line goal-skeleton-line--short"></div>
      </section>
    `;
  }

  async function api(method, path, body) {
    const opts = { method, credentials: 'include', headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(path, opts);
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  // Render each project milestone area in one place so refreshes stay simple.
  function renderMilestones(projectId, milestones, stats) {
    const pct = stats && typeof stats.completion_pct === 'number' ? stats.completion_pct : 0;
    const items = milestones
      .map(
        (m) => `
      <li class="milestone-item${m.is_completed ? ' milestone-item--done' : ''}" data-ms-id="${m.milestone_id}">
        <label class="milestone-item__title">
          <input type="checkbox" class="ms-done" data-ms-id="${m.milestone_id}" ${m.is_completed ? 'checked' : ''} />
          ${esc(m.title)}
        </label>
        <button type="button" class="btn btn-secondary btn-sm ms-edit" data-ms-id="${m.milestone_id}">Edit</button>
        <button type="button" class="btn btn-secondary btn-sm ms-del" data-ms-id="${m.milestone_id}">Delete</button>
      </li>`
      )
      .join('');

    return `
      <div class="project-block__progress compact">
        <label>Milestone progress</label>
        <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
        <p class="project-progress-copy">${pct}% complete</p>
      </div>
      <ul class="milestone-list">${items || '<li class="milestone-item">No milestones yet.</li>'}</ul>
      <div class="compact-fields">
        <input type="text" class="input ms-new-title" placeholder="New milestone title" data-project-id="${projectId}" />
        <input type="date" class="input ms-new-date" data-project-id="${projectId}" />
        <button type="button" class="btn btn-primary ms-add" data-project-id="${projectId}">Add milestone</button>
      </div>
    `;
  }

  // Keep each project block self-contained so the goal hub is easier to scan.
  function renderProjectBlock(p) {
    const ms = p.milestones || [];
    return `
      <section class="project-block" data-project-id="${p.project_id}">
        <div class="project-block__head">
          <div>
            <h3>${esc(p.title)}</h3>
            ${p.description ? `<p class="project-block__desc">${esc(p.description)}</p>` : ''}
          </div>
          <div class="project-block__actions">
            <button type="button" class="btn btn-secondary btn-sm proj-edit" data-project-id="${p.project_id}">Edit project</button>
            <button type="button" class="btn btn-secondary btn-sm proj-del" data-project-id="${p.project_id}">Delete project</button>
          </div>
        </div>
        <div class="goal-card__stats project-stats">
          <div><strong>${p.stats?.milestone_total || 0}</strong><span>Total milestones</span></div>
          <div><strong>${p.stats?.milestone_done || 0}</strong><span>Completed</span></div>
          <div><strong>${p.stats?.completion_pct || 0}%</strong><span>Progress</span></div>
        </div>
        <div class="milestone-wrap" data-project-id="${p.project_id}">
          ${renderMilestones(p.project_id, ms, p.stats)}
        </div>
      </section>
    `;
  }

  async function wireProjectBlock(section, goalId, onReload) {
    const projectId = Number(section.getAttribute('data-project-id'));

    section.querySelector('.proj-edit')?.addEventListener('click', async () => {
      const p = await fetchProject(projectId, goalId);
      if (!p) return;
      const t = prompt('Project title', p.title);
      if (t === null || t.trim().length < 1) return;
      const d = prompt('Description (optional)', p.description || '') ?? '';
      const { res, data } = await api('PUT', `/api/projects/${projectId}`, {
        title: t.trim(),
        description: d.trim() || null
      });
      if (res.status === 401) {
        window.location.href = 'login.html';
        return;
      }
      if (!data.success) {
        showErr(data.error || 'Update failed');
        return;
      }
      await onReload();
    });

    section.querySelector('.proj-del')?.addEventListener('click', async () => {
      if (!confirm('Delete this project and its milestones?')) return;
      const { res, data } = await api('DELETE', `/api/projects/${projectId}`);
      if (res.status === 401) {
        window.location.href = 'login.html';
        return;
      }
      if (!data.success) {
        showErr(data.error || 'Delete failed');
        return;
      }
      await onReload();
    });

    const wrap = section.querySelector('.milestone-wrap');
    wireMilestones(wrap, projectId, onReload);
  }

  async function fetchProject(projectId) {
    const { res, data } = await api('GET', `/api/goals/${goalId}/hub`);
    if (!data.success) return null;
    return (data.projects || []).find((x) => x.project_id === projectId);
  }

  function wireMilestones(wrap, projectId, onReload) {
    if (!wrap) return;

    wrap.querySelectorAll('.ms-done').forEach((cb) => {
      cb.addEventListener('change', async () => {
        const id = cb.getAttribute('data-ms-id');
        const { res, data } = await api('PATCH', `/api/milestones/${id}/completion`, {
          is_completed: cb.checked
        });
        if (res.status === 401) {
          window.location.href = 'login.html';
          return;
        }
        if (!data.success) {
          showErr(data.error || 'Could not update milestone');
          cb.checked = !cb.checked;
          return;
        }
        await onReload();
      });
    });

    wrap.querySelectorAll('.ms-edit').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-ms-id');
        const { res, data } = await api('GET', `/api/projects/${projectId}/milestones`);
        if (!data.success) return;
        const m = (data.results || []).find((x) => String(x.milestone_id) === String(id));
        if (!m) return;
        const t = prompt('Milestone title', m.title);
        if (t === null || t.trim().length < 1) return;
        const desc = prompt('Description (optional)', m.description || '') ?? '';
        const td = prompt('Target date YYYY-MM-DD (optional)', m.target_date ? String(m.target_date).slice(0, 10) : '') ?? '';
        const { res: r2, data: d2 } = await api('PUT', `/api/milestones/${id}`, {
          title: t.trim(),
          description: desc.trim() || null,
          target_date: td.trim() || null
        });
        if (r2.status === 401) {
          window.location.href = 'login.html';
          return;
        }
        if (!d2.success) {
          showErr(d2.error || 'Update failed');
          return;
        }
        await onReload();
      });
    });

    wrap.querySelectorAll('.ms-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this milestone?')) return;
        const id = btn.getAttribute('data-ms-id');
        const { res, data } = await api('DELETE', `/api/milestones/${id}`);
        if (res.status === 401) {
          window.location.href = 'login.html';
          return;
        }
        if (!data.success) {
          showErr(data.error || 'Delete failed');
          return;
        }
        await onReload();
      });
    });

    wrap.querySelector('.ms-add')?.addEventListener('click', async () => {
      const titleIn = wrap.querySelector('.ms-new-title');
      const dateIn = wrap.querySelector('.ms-new-date');
      const title = titleIn.value.trim();
      if (title.length < 1) {
        showErr('Milestone title required');
        return;
      }
      const { res, data } = await api('POST', `/api/projects/${projectId}/milestones`, {
        title,
        target_date: dateIn.value || null
      });
      if (res.status === 401) {
        window.location.href = 'login.html';
        return;
      }
      if (!data.success) {
        showErr(data.error || 'Could not add milestone');
        return;
      }
      titleIn.value = '';
      dateIn.value = '';
      await onReload();
    });
  }

  // Rebuild the full goal hub after changes so the summary numbers stay correct.
  async function loadAll() {
    showErr('');
    root.innerHTML = detailLoadingMarkup();
    if (!goalId) {
      root.innerHTML = '';
      showErr('Missing goal id.');
      return;
    }

    const { res: hubRes, data: hubData } = await api('GET', `/api/goals/${goalId}/hub`);
    if (hubRes.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    if (!hubData.success || !hubData.goal) {
      root.innerHTML = '';
      showErr(hubData.error || 'Goal not found.');
      return;
    }
    const goal = hubData.goal;
    const projects = hubData.projects || [];
    const stats = hubData.stats || { project_count: 0, milestone_total: 0, milestone_done: 0, completion_pct: 0 };
    const tk = goal.template_kind || 'none';

    let templateBanner = '';
    if (tk === 'draft') {
      templateBanner = `
      <section class="card goal-detail-callout">
        <h2 class="goal-detail-callout__title">Goal template (draft)</h2>
        <p class="goal-detail-callout__body">
          Build this like any goal: add projects, milestones, and resources below. When ready, publish so other students can import a copy into their goals.
        </p>
        <button type="button" class="btn btn-primary" id="publishTemplateBtn">Publish template</button>
      </section>`;
    } else if (tk === 'published') {
      templateBanner = `
      <section class="card goal-detail-callout">
        <h2 class="goal-detail-callout__title">Published community template</h2>
        <p class="goal-detail-callout__body">Imported ${esc(String(goal.template_copied_count ?? 0))} times · Listed on Templates for other students.</p>
      </section>`;
    }

    // Keep the goal hub sections structured and readable, especially on smaller screens.
    let html = `
      <div class="goal-detail-head">
        <a href="goals.html" class="back-link">← All goals</a>
        <h1>${esc(goal.title)}</h1>
        <p class="goal-detail-meta">${esc(goal.category || '')}${goal.target_date ? ` · Target ${esc(goal.target_date)}` : ''}</p>
        ${goal.description ? `<p class="goal-detail-meta">${esc(goal.description)}</p>` : ''}
        <p><span class="status-badge">${esc(goal.status)}</span>${tk !== 'none' ? ` <span class="status-badge">${esc(tk)}</span>` : ''}</p>
      </div>
      ${templateBanner}
      <section class="card goal-summary">
        <h2>Goal summary</h2>
        <div class="goal-card__stats">
          <div><strong>${stats.project_count || 0}</strong><span>Projects</span></div>
          <div><strong>${stats.milestone_done || 0}/${stats.milestone_total || 0}</strong><span>Milestones done</span></div>
          <div><strong>${stats.completion_pct || 0}%</strong><span>Total progress</span></div>
        </div>
        <div class="project-block__progress compact">
          <label>Overall completion</label>
          <div class="progress"><div class="progress-bar" style="width:${stats.completion_pct || 0}%"></div></div>
        </div>
      </section>
      <section class="card goal-detail-callout" id="goal-resources-section">
        <h2 class="goal-detail-callout__title">Attached resources</h2>
        <div id="goal-resource-list" class="goal-detail-empty">Loading…</div>
        <div class="inline-form">
          <select id="bookmarkResourcePick" class="input">
            <option value="">Select a saved resource…</option>
          </select>
          <button type="button" class="btn btn-primary" id="attachResourceBtn">Attach to goal</button>
        </div>
        <p class="goal-resource-note">Only public resources or ones you submitted can be attached.</p>
      </section>
      <section class="card goal-detail-callout">
        <h2 class="goal-detail-callout__title">Add project</h2>
        <div class="inline-form">
          <input type="text" id="newProjectTitle" class="input" placeholder="Project title" />
          <input type="text" id="newProjectDesc" class="input" placeholder="Description (optional)" />
          <button type="button" class="btn btn-primary" id="addProjectBtn">Add project</button>
        </div>
      </section>
      <h2>Projects</h2>
    `;

    for (const p of projects) {
      html += renderProjectBlock(p);
    }

    if (projects.length === 0) {
      html += '<p class="goal-detail-empty">No projects yet. Add one above.</p>';
    }

    root.innerHTML = html;

    async function refreshGoalResources() {
      const listEl = document.getElementById('goal-resource-list');
      const pick = document.getElementById('bookmarkResourcePick');
      if (!listEl || !pick) return;
      const { res, data } = await api('GET', `/api/goals/${goalId}/attachments`);
      if (!data.success) {
        listEl.innerHTML = '<p class="error">Could not load attachments.</p>';
        return;
      }
      const resources = (data.results || []).filter((x) => x.type === 'resource');
      listEl.innerHTML =
        resources.length === 0
          ? '<p class="goal-detail-empty">No resources attached yet.</p>'
          : `<ul class="milestone-list">${resources
              .map(
                (r) => `
          <li class="milestone-item">
            <strong>${esc(r.title)}</strong>
            <span class="goal-resource-id">#${r.id}</span>
            <button type="button" class="btn btn-secondary btn-sm goal-res-detach" data-rid="${r.id}">Remove</button>
          </li>`
              )
              .join('')}</ul>`;
      listEl.querySelectorAll('.goal-res-detach').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const rid = btn.getAttribute('data-rid');
          const r2 = await fetch(`/api/goals/${goalId}/resources/${rid}`, { method: 'DELETE', credentials: 'include' });
          const d2 = await r2.json().catch(() => ({}));
          if (!r2.ok || !d2.success) {
            showErr(d2.error || 'Could not remove resource');
            return;
          }
          await refreshGoalResources();
        });
      });

      const bm = await fetch('/api/bookmarks', { credentials: 'include' });
      const bmData = await bm.json().catch(() => ({}));
      const attached = new Set(resources.map((r) => String(r.id)));
      pick.innerHTML = '<option value="">Select a saved resource…</option>';
      if (bm.ok && bmData.success && Array.isArray(bmData.results)) {
        for (const r of bmData.results) {
          const id = String(r.resource_id);
          if (attached.has(id)) continue;
          const opt = document.createElement('option');
          opt.value = id;
          opt.textContent = `${r.title || 'Resource'} (#${id})`;
          pick.appendChild(opt);
        }
      }
    }

    await refreshGoalResources();

    document.getElementById('attachResourceBtn')?.addEventListener('click', async () => {
      const pick = document.getElementById('bookmarkResourcePick');
      const rid = Number(pick?.value);
      if (!rid) {
        showErr('Pick a saved resource to attach.');
        return;
      }
      const { res, data } = await api('POST', `/api/goals/${goalId}/resources`, { resource_id: rid });
      if (res.status === 401) {
        window.location.href = 'login.html';
        return;
      }
      if (!data.success) {
        showErr(data.error || 'Attach failed');
        return;
      }
      pick.value = '';
      await refreshGoalResources();
    });

    document.getElementById('publishTemplateBtn')?.addEventListener('click', async () => {
      if (!confirm('Publish this goal as a community template? Other students can import a copy.')) return;
      const { res, data } = await api('POST', `/api/goal-templates/${goalId}/publish`, {});
      if (res.status === 401) {
        window.location.href = 'login.html';
        return;
      }
      if (!data.success) {
        showErr(data.error || 'Publish failed');
        return;
      }
      await loadAll();
    });

    document.getElementById('addProjectBtn')?.addEventListener('click', async () => {
      const t = document.getElementById('newProjectTitle').value.trim();
      const d = document.getElementById('newProjectDesc').value.trim();
      if (t.length < 1) {
        showErr('Project title required');
        return;
      }
      const { res, data } = await api('POST', `/api/goals/${goalId}/projects`, {
        title: t,
        description: d || null
      });
      if (res.status === 401) {
        window.location.href = 'login.html';
        return;
      }
      if (!data.success) {
        showErr(data.error || 'Could not create project');
        return;
      }
      document.getElementById('newProjectTitle').value = '';
      document.getElementById('newProjectDesc').value = '';
      await loadAll();
    });

    root.querySelectorAll('.project-block').forEach((sec) => wireProjectBlock(sec, goalId, loadAll));
  }

  loadAll();
})();
