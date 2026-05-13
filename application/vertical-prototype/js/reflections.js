/**
 * Why:
 *   This file is need so we can correctly allow users to write, or delete their journal
 *   entries that could potentially be tied to their goals. Beside being able to add new
 *   entries or delete them, they need to be be able to view their previous entries as well
 *
 * What:
 *   This js file will load exisiting reflection history and present them as well as create
 *   and delete reflection using the reflection form.
 *
 * Where used:
 *   It is loaded/called by vertical-prototype/reflections.html
 *
 * Notes:
 *   - The APIs it calls: 
 *        /api/reflections
 *        /api/reflections/:id
 *   - As usual, we redirect user to the login.html on 401
 */

(function () {
  const listEl = document.getElementById('refl-list');
  const errEl = document.getElementById('refl-error');
  const form = document.getElementById('refl-form');
  const linkTreeEl = document.getElementById('reflection-link-tree');
  const clearLinksBtn = document.getElementById('clear-reflection-links');

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

  // ------------------------------------------
  function formatDate(value) {
    if (!value) return '';
    return String(value).slice(0, 10);
  }

  function getCheckedValues(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
      .map((input) => Number(input.value))
      .filter((value) => Number.isInteger(value) && value > 0);
  }

  function renderChips(label, items, className, idKey) {
    if (!items || items.length === 0) return '';

    return items.map((item) => `
      <span class="reflection-chip ${className}">
        ${label}: ${esc(item.title || item[idKey])}
      </span>
    `).join('');
  }
  // ------------------------------------------

  function renderLinkOptions(goals) {
    if (!Array.isArray(goals) || goals.length === 0) {
      linkTreeEl.innerHTML = `
        <div class="empty-state">
          <p class="empty-state__heading">No goals yet</p>
          <p class="empty-state__body">Create a goal first, then link reflections to your plan.</p>
          <a href="goals.html" class="btn btn-primary">Create a goal</a>
        </div>`;
      return;
    }

    linkTreeEl.innerHTML = goals.map((goal) => {
      const projectMarkup = (goal.projects || []).map((project) => {
        const milestoneMarkup = (project.milestones || []).map((milestone) => `
          <label class="reflection-node-label reflection-milestone-node">
            <input
              type="checkbox"
              name="reflection_milestone_ids"
              value="${milestone.milestone_id}"
              data-project-id="${project.project_id}"
              data-goal-id="${goal.goal_id}"
            />
            <span>
              <span class="reflection-node-title">${esc(milestone.title)}</span>
              <span class="reflection-node-meta">
                ${milestone.is_completed ? 'Completed' : 'Open'}
                ${milestone.target_date ? ` · Target ${esc(formatDate(milestone.target_date))}` : ''}
              </span>
            </span>
          </label>
        `).join('');

        return `
          <div class="reflection-project-node">
            <label class="reflection-node-label">
              <input
                type="checkbox"
                name="reflection_project_ids"
                value="${project.project_id}"
                data-goal-id="${goal.goal_id}"
              />
              <span>
                <span class="reflection-node-title">${esc(project.title)}</span>
                ${project.description ? `<span class="reflection-node-meta">${esc(project.description)}</span>` : ''}
              </span>
            </label>

            <div class="reflection-milestone-list">
              ${milestoneMarkup || '<p class="reflection-node-meta">No milestones yet.</p>'}
            </div>
          </div>`;
      }).join('');

      return `
        <article class="reflection-goal-node">
          <label class="reflection-node-label">
            <input type="checkbox" name="reflection_goal_ids" value="${goal.goal_id}" />
            <span>
              <span class="reflection-node-title">${esc(goal.title)}</span>
              <span class="reflection-node-meta">
                ${esc(goal.category || 'Uncategorized')} · ${esc(goal.status || 'active')}
                ${goal.target_date ? ` · Target ${esc(formatDate(goal.target_date))}` : ''}
              </span>
            </span>
          </label>

          <div class="reflection-project-list">
            ${projectMarkup || '<p class="reflection-node-meta">No projects under this goal yet.</p>'}
          </div>
        </article>`;
    }).join('');

    wireAutoSelection();
  }

  function wireAutoSelection() {
    linkTreeEl.querySelectorAll('input[name="reflection_project_ids"]').forEach((projectCheckbox) => {
      projectCheckbox.addEventListener('change', () => {
        if (!projectCheckbox.checked) return;

        const goalCheckbox = linkTreeEl.querySelector(
          `input[name="reflection_goal_ids"][value="${projectCheckbox.dataset.goalId}"]`
        );

        if (goalCheckbox) goalCheckbox.checked = true;
      });
    });

    linkTreeEl.querySelectorAll('input[name="reflection_milestone_ids"]').forEach((milestoneCheckbox) => {
      milestoneCheckbox.addEventListener('change', () => {
        if (!milestoneCheckbox.checked) return;

        const goalCheckbox = linkTreeEl.querySelector(
          `input[name="reflection_goal_ids"][value="${milestoneCheckbox.dataset.goalId}"]`
        );

        const projectCheckbox = linkTreeEl.querySelector(
          `input[name="reflection_project_ids"][value="${milestoneCheckbox.dataset.projectId}"]`
        );

        if (goalCheckbox) goalCheckbox.checked = true;
        if (projectCheckbox) projectCheckbox.checked = true;
      });
    });
  }

  async function loadLinkOptions() {
    try {
      const res = await fetch('/api/reflections/link-options', { credentials: 'include' });

      if (res.status === 401) {
        window.location.href = 'login.html';
        return;
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not load link options.');
      }

      renderLinkOptions(data.results || []);
    } catch (err) {
      linkTreeEl.innerHTML = `<p class="error">${esc(err.message || 'Could not load link options.')}</p>`;
    }
  }

  clearLinksBtn.addEventListener('click', () => {
    linkTreeEl.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = false;
    });
  });

  // ==========================================
  async function load() {
    showErr('');
    const res = await fetch('/api/reflections', { credentials: 'include' });
    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    const data = await res.json();
    if (!data.success) {
      listEl.innerHTML = '';
      showErr(data.error || 'Could not load reflections.');
      return;
    }
    const rows = data.results || [];
    if (rows.length === 0) {
      listEl.innerHTML = '<p>No reflections yet.</p>';
      return;
    }

    // =========================================
    listEl.innerHTML = rows
      .map((r) => {
        const goalChips = renderChips('Goal', r.linked_goals, '', 'goal_id');
        const projectChips = renderChips('Project', r.linked_projects, 'reflection-chip--project', 'project_id');
        const milestoneChips = renderChips('Milestone', r.linked_milestones, 'reflection-chip--milestone', 'milestone_id');
        const hasLinks = goalChips || projectChips || milestoneChips;

        return `
          <article class="goal-row">
            <div>
              <p>${esc(r.body)}</p>
              <p class="goal-row__meta">
                ${esc(String(r.created_at).slice(0, 19).replace('T', ' '))}
              </p>

              ${
                hasLinks
                  ? `<div class="reflection-link-summary">${goalChips}${projectChips}${milestoneChips}</div>`
                  : '<p class="goal-row__meta">No goals, projects, or milestones linked.</p>'
              }
            </div>

            <div class="goal-row__actions">
              <button type="button" class="btn btn-secondary btn-del" data-id="${r.reflection_id}">
                Delete
              </button>
            </div>
          </article>`;
      })
      .join('');
    // =========================================

    listEl.querySelectorAll('.btn-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this reflection?')) return;
        const id = btn.getAttribute('data-id');
        const r = await fetch(`/api/reflections/${id}`, { method: 'DELETE', credentials: 'include' });
        const d = await r.json();
        if (!d.success) {
          showErr(d.error || 'Delete failed');
          return;
        }
        load();
      });
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // --------------------------------------------------
    const body = document.getElementById('refl-body').value.trim();

    const payload = {
      body,
      goal_ids: getCheckedValues('reflection_goal_ids'),
      project_ids: getCheckedValues('reflection_project_ids'),
      milestone_ids: getCheckedValues('reflection_milestone_ids')
    };
    // --------------------------------------------------

    const res = await fetch('/api/reflections', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },

      // --------------------------------------
      body: JSON.stringify(payload)
      // --------------------------------------

      
    });
    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    const data = await res.json();
    if (!data.success) {
      showErr(data.error || 'Could not save.');
      return;
    }
    
    // ---------------
    form.reset();

    linkTreeEl.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = false;
    });

    load();
    // ---------------

  });

  // ----------
  loadLinkOptions();
  load();
  // ----------

})();
