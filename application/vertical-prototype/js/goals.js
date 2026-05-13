/**
 * Why:
 *   This file implements the goals page where users can create new goals, edit an already
 *   existing goal metadata and delete. Can also filter, and sort the goals as well as add
 *   markers of the goal (done, active or paused)
 *
 * What:
 *   For each goals, it fetches their overview data, renders their card, manages the 
 *   create/edit modal, as well as send CRUD requests and automatically refershes the page
 *   after immediate valid change.
 *
 * Where used:
 *   It is loaded/called by vertical-prototype/goals.html
 *
 * Notes:
 *   - The APIs it calls: 
 *        /api/goals-overview, 
 *        /api/goals, 
 *        /api/goals/:id,
 *     /api/goals/:id/status.
 *   - As usual, we redirect user to the login.html on 401
 *   - This file expects the modal and all the form elements to be present in goals.html.
 */

(function () {
  const listEl = document.getElementById('goals-list');
  const errEl = document.getElementById('goals-error');
  const goalsTokenBalanceEl = document.getElementById('goalsTokenBalance');

  const chooserModal = document.getElementById('goalCreateChooserModal');
  const chooseManualBtn = document.getElementById('chooseManualBtn');
  const chooseAiBtn = document.getElementById('chooseAiBtn');
  const chooserCancelBtn = document.getElementById('goalCreateChooserCancelBtn');

  const manualModal = document.getElementById('goalModal');
  const manualForm = document.getElementById('goalForm');
  const manualTitleEl = document.getElementById('goalModalTitle');
  const goalIdInput = document.getElementById('goalId');
  const titleInput = document.getElementById('goalTitle');
  const descInput = document.getElementById('goalDescription');
  const catInput = document.getElementById('goalCategory');
  const dateInput = document.getElementById('goalTargetDate');
  const manualCancelBtn = document.getElementById('goalCancelBtn');

  const aiModal = document.getElementById('aiGoalModal');
  const aiForm = document.getElementById('aiGoalForm');
  const aiGoalTitle = document.getElementById('aiGoalTitle');
  const aiGoalDescription = document.getElementById('aiGoalDescription');
  const aiGoalCategory = document.getElementById('aiGoalCategory');
  const aiGoalTargetDate = document.getElementById('aiGoalTargetDate');
  const aiGenerateBtn = document.getElementById('aiGenerateBtn');
  const aiCancelBtn = document.getElementById('aiCancelBtn');
  const aiGoalError = document.getElementById('aiGoalError');
  const aiDraftSection = document.getElementById('aiDraftSection');
  const aiDraftSummary = document.getElementById('aiDraftSummary');
  const aiDraftProjects = document.getElementById('aiDraftProjects');
  const aiDraftResources = document.getElementById('aiDraftResources');
  const aiSaveBtn = document.getElementById('aiSaveBtn');
  const aiWizardTokenBalance = document.getElementById('aiWizardTokenBalance');
  const qWeeklyTime = document.getElementById('qWeeklyTime');
  const qWorkOrganization = document.getElementById('qWorkOrganization');
  const qMilestoneGranularity = document.getElementById('qMilestoneGranularity');
  const qResourceSuggestions = document.getElementById('qResourceSuggestions');
  const qDeadlineFirmness = document.getElementById('qDeadlineFirmness');

  const purchaseModal = document.getElementById('tokenPurchaseModal');
  const purchaseTokenBalance = document.getElementById('purchaseTokenBalance');
  const tokenPurchaseCloseBtn = document.getElementById('tokenPurchaseCloseBtn');
  const tokenPurchaseMsg = document.getElementById('tokenPurchaseMsg');
  const tokenPackButtons = Array.from(document.querySelectorAll('.token-pack-btn'));

  const openCreateBtn = document.getElementById('openCreateBtn');
  const statusFilter = document.getElementById('statusFilter');
  const sortBy = document.getElementById('sortBy');

  let cachedRows = [];
  let tokenBalance = null;
  let currentDraft = null;
  let currentPreset = null;

  function showErr(msg) {
    errEl.textContent = msg || '';
    errEl.hidden = !msg;
  }

  function showAiError(msg) {
    aiGoalError.textContent = msg || '';
    aiGoalError.hidden = !msg;
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function updateTokenDisplays() {
    const value = tokenBalance == null ? '--' : String(tokenBalance);
    if (goalsTokenBalanceEl) goalsTokenBalanceEl.textContent = value;
    if (aiWizardTokenBalance) aiWizardTokenBalance.textContent = value;
    if (purchaseTokenBalance) purchaseTokenBalance.textContent = value;
  }

  function collectQuestionnaireAnswers() {
    return {
      weekly_time: qWeeklyTime.value,
      work_organization: qWorkOrganization.value,
      milestone_granularity: qMilestoneGranularity.value,
      resource_suggestions: qResourceSuggestions.value,
      deadline_firmness: qDeadlineFirmness.value
    };
  }

  function collectGoalPayloadFromAiForm() {
    return {
      title: aiGoalTitle.value.trim(),
      description: aiGoalDescription.value.trim(),
      category: aiGoalCategory.value.trim() || null,
      target_date: aiGoalTargetDate.value || null
    };
  }

  function statusClass(status) {
    if (status === 'paused') return 'status-badge--paused';
    if (status === 'completed') return 'status-badge--completed';
    return '';
  }

  function emptyGoalsMarkup(title, body) {
    return `
      <div class="card goal-empty-state">
        <p class="goal-empty-state__title">${esc(title)}</p>
        <p class="goal-empty-state__body">${esc(body)}</p>
      </div>
    `;
  }

  function loadingGoalsMarkup() {
    return Array.from({ length: 3 }).map(() => `
      <article class="goal-card goal-card--skeleton">
        <div class="goal-skeleton-block goal-skeleton-title"></div>
        <div class="goal-skeleton-block goal-skeleton-meta"></div>
        <div class="goal-skeleton-block goal-skeleton-line"></div>
      </article>
    `).join('');
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

  async function loadTokenBalance() {
    const { res, data } = await api('GET', '/api/ai-tokens/balance');
    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    if (data && data.success) {
      tokenBalance = Number(data.balance) || 0;
      updateTokenDisplays();
    }
  }

  function applyFiltersAndSort(rows) {
    const filtered = rows.filter((r) => {
      if (!statusFilter || statusFilter.value === 'all') return true;
      return r.status === statusFilter.value;
    });

    const copy = [...filtered];
    const sortValue = sortBy ? sortBy.value : 'recent';
    if (sortValue === 'progress-desc') {
      copy.sort((a, b) => (b.completion_pct || 0) - (a.completion_pct || 0));
    } else if (sortValue === 'progress-asc') {
      copy.sort((a, b) => (a.completion_pct || 0) - (b.completion_pct || 0));
    } else if (sortValue === 'target-date') {
      copy.sort((a, b) => {
        if (!a.target_date && !b.target_date) return 0;
        if (!a.target_date) return 1;
        if (!b.target_date) return -1;
        return String(a.target_date).localeCompare(String(b.target_date));
      });
    } else {
      copy.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
    }
    return copy;
  }

  function renderList(rows) {
    if (rows.length === 0) {
      listEl.innerHTML = emptyGoalsMarkup(
        'No goals match this filter',
        'Try another status or create a new goal to keep planning.'
      );
      return;
    }
    listEl.innerHTML = rows
      .map(
        (g) => `
      <article class="goal-card" data-id="${g.goal_id}">
        <header class="goal-card__head">
          <div>
            <h2 class="goal-card__title">${esc(g.title)}</h2>
            <p class="goal-row__meta">${esc(g.category || 'Uncategorized')}${g.target_date ? ` · Target ${esc(String(g.target_date).slice(0, 10))}` : ''}</p>
          </div>
          <span class="status-badge ${statusClass(g.status)}">${esc(g.status)}</span>
        </header>
        ${g.description ? `<p class="goal-card__description">${esc(g.description)}</p>` : ''}
        <div class="goal-card__stats">
          <div><strong>${g.project_count || 0}</strong><span>Projects</span></div>
          <div><strong>${(g.milestone_done || 0)}/${g.milestone_total || 0}</strong><span>Milestones done</span></div>
          <div><strong>${g.completion_pct || 0}%</strong><span>Progress</span></div>
        </div>
        <div class="project-block__progress">
          <label>Goal progress</label>
          <div class="progress"><div class="progress-bar" style="width:${g.completion_pct || 0}%"></div></div>
        </div>
        <div class="goal-card__actions">
          <a class="btn btn-primary" href="goal.html?id=${g.goal_id}">Open Goal Hub</a>
          <select class="input status-select" data-goal-id="${g.goal_id}" aria-label="Change status">
            <option value="active"${g.status === 'active' ? ' selected' : ''}>Active</option>
            <option value="paused"${g.status === 'paused' ? ' selected' : ''}>Paused</option>
            <option value="completed"${g.status === 'completed' ? ' selected' : ''}>Completed</option>
          </select>
          <button type="button" class="btn btn-secondary btn-edit" data-goal-id="${g.goal_id}">Edit</button>
          <button type="button" class="btn btn-secondary btn-delete" data-goal-id="${g.goal_id}">Delete</button>
        </div>
      </article>`
      )
      .join('');

    listEl.querySelectorAll('.status-select').forEach((sel) => {
      sel.addEventListener('change', async () => {
        const id = sel.getAttribute('data-goal-id');
        const { res: r, data: d } = await api('PATCH', `/api/goals/${id}/status`, {
          status: sel.value
        });
        if (r.status === 401) {
          window.location.href = 'login.html';
          return;
        }
        if (!d.success) {
          showErr(d.error || 'Status update failed.');
          await loadGoals();
          return;
        }
        await loadGoals();
      });
    });

    listEl.querySelectorAll('.btn-edit').forEach((btn) => {
      btn.addEventListener('click', () => openEdit(Number(btn.getAttribute('data-goal-id'))));
    });

    listEl.querySelectorAll('.btn-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-goal-id');
        if (!confirm('Delete this goal and all of its projects/milestones?')) return;
        const { res: r, data: d } = await api('DELETE', `/api/goals/${id}`);
        if (r.status === 401) {
          window.location.href = 'login.html';
          return;
        }
        if (!d.success) {
          showErr(d.error || 'Delete failed.');
          return;
        }
        await loadGoals();
      });
    });
  }

  function renderFromCache() {
    renderList(applyFiltersAndSort(cachedRows));
  }

  async function loadGoals() {
    showErr('');
    listEl.innerHTML = loadingGoalsMarkup();
    const { res, data } = await api('GET', '/api/goals-overview');
    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    if (!data.success) {
      listEl.innerHTML = '';
      showErr(data.error || 'Could not load goals.');
      return;
    }
    cachedRows = data.results || [];
    if (cachedRows.length === 0) {
      listEl.innerHTML = emptyGoalsMarkup(
        'No goals yet',
        'Create your first goal to start tracking projects and milestones.'
      );
      return;
    }
    renderFromCache();
  }

  function openManualCreate() {
    manualTitleEl.textContent = 'New goal';
    goalIdInput.value = '';
    titleInput.value = '';
    descInput.value = '';
    catInput.value = '';
    dateInput.value = '';
    manualModal.hidden = false;
    titleInput.focus();
  }

  function closeManualModal() {
    manualModal.hidden = true;
  }

  function openChooserModal() {
    chooserModal.hidden = false;
  }

  function closeChooserModal() {
    chooserModal.hidden = true;
  }

  function openAiModal() {
    aiModal.hidden = false;
    aiGoalTitle.focus();
  }

  function closeAiModal() {
    aiModal.hidden = true;
    showAiError('');
    aiDraftSection.hidden = true;
    aiDraftProjects.innerHTML = '';
    aiDraftResources.innerHTML = '';
    currentDraft = null;
    currentPreset = null;
  }

  function openPurchaseModal() {
    tokenPurchaseMsg.textContent = '';
    purchaseModal.hidden = false;
    updateTokenDisplays();
  }

  function closePurchaseModal() {
    purchaseModal.hidden = true;
  }

  function createMilestoneEditor(projectIndex, milestoneIndex, milestone) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-draft-milestone';
    wrapper.innerHTML = `
      <label>Milestone title
        <input type="text" class="input ai-edit-mile-title" value="${esc(milestone.title || '')}" data-project="${projectIndex}" data-milestone="${milestoneIndex}" />
      </label>
      <label>Milestone description
        <textarea class="input ai-edit-mile-desc" rows="2" data-project="${projectIndex}" data-milestone="${milestoneIndex}">${esc(milestone.description || '')}</textarea>
      </label>
      <label>Target date
        <input type="date" class="input ai-edit-mile-date" value="${milestone.target_date || ''}" data-project="${projectIndex}" data-milestone="${milestoneIndex}" />
      </label>
    `;
    return wrapper;
  }

  function renderDraftEditors(draft) {
    aiDraftSummary.textContent = draft.plan_summary || 'AI draft generated.';
    aiDraftProjects.innerHTML = '';
    draft.projects.forEach((project, projectIndex) => {
      const card = document.createElement('article');
      card.className = 'card ai-draft-project';
      card.innerHTML = `
        <label>Project title
          <input type="text" class="input ai-edit-project-title" value="${esc(project.title || '')}" data-project="${projectIndex}" />
        </label>
        <label>Project description
          <textarea class="input ai-edit-project-desc" rows="2" data-project="${projectIndex}">${esc(project.description || '')}</textarea>
        </label>
      `;
      const milestoneWrap = document.createElement('div');
      milestoneWrap.className = 'ai-draft-milestone-wrap';
      project.milestones.forEach((milestone, milestoneIndex) => {
        milestoneWrap.appendChild(createMilestoneEditor(projectIndex, milestoneIndex, milestone));
      });
      card.appendChild(milestoneWrap);
      aiDraftProjects.appendChild(card);
    });

    aiDraftProjects.querySelectorAll('.ai-edit-project-title').forEach((input) => {
      input.addEventListener('input', () => {
        const p = Number(input.dataset.project);
        currentDraft.projects[p].title = input.value.trim();
      });
    });
    aiDraftProjects.querySelectorAll('.ai-edit-project-desc').forEach((input) => {
      input.addEventListener('input', () => {
        const p = Number(input.dataset.project);
        currentDraft.projects[p].description = input.value.trim() || null;
      });
    });
    aiDraftProjects.querySelectorAll('.ai-edit-mile-title').forEach((input) => {
      input.addEventListener('input', () => {
        const p = Number(input.dataset.project);
        const m = Number(input.dataset.milestone);
        currentDraft.projects[p].milestones[m].title = input.value.trim();
      });
    });
    aiDraftProjects.querySelectorAll('.ai-edit-mile-desc').forEach((input) => {
      input.addEventListener('input', () => {
        const p = Number(input.dataset.project);
        const m = Number(input.dataset.milestone);
        currentDraft.projects[p].milestones[m].description = input.value.trim() || null;
      });
    });
    aiDraftProjects.querySelectorAll('.ai-edit-mile-date').forEach((input) => {
      input.addEventListener('change', () => {
        const p = Number(input.dataset.project);
        const m = Number(input.dataset.milestone);
        currentDraft.projects[p].milestones[m].target_date = input.value || null;
      });
    });
  }

  function renderPreviewResources(resources) {
    if (!resources.length) {
      aiDraftResources.innerHTML = '<p class="goals-subtitle">No preview resources found for this draft.</p>';
      return;
    }
    aiDraftResources.innerHTML = resources
      .map((resource) => {
        const title = esc(resource.title || 'Untitled resource');
        const description = esc(resource.description || '');
        const category = esc(resource.category_name || 'General');
        const url = resource.url ? `<a href="${esc(resource.url)}" target="_blank" rel="noopener noreferrer">Open</a>` : '';
        return `
          <label class="card ai-resource-item">
            <input type="checkbox" class="ai-resource-checkbox" value="${resource.resource_id}" />
            <div>
              <p><strong>${title}</strong></p>
              <p class="goals-subtitle">${description}</p>
              <p class="goals-subtitle">${category} ${url ? `· ${url}` : ''}</p>
            </div>
          </label>
        `;
      })
      .join('');
  }

  async function generateAiDraft() {
    showAiError('');
    const goal = collectGoalPayloadFromAiForm();
    const questionnaire = collectQuestionnaireAnswers();
    if (goal.title.length < 2 || !goal.description) {
      showAiError('Please provide a goal title and prompt before generating.');
      return;
    }

    aiGenerateBtn.disabled = true;
    aiGenerateBtn.textContent = 'Generating...';
    aiDraftSection.hidden = true;
    currentDraft = null;
    currentPreset = null;

    const { res, data } = await api('POST', '/api/ai/goal-plan-draft', { goal, questionnaire });
    aiGenerateBtn.disabled = false;
    aiGenerateBtn.textContent = 'Generate draft';

    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    if (!data.success) {
      showAiError(data.details || 'Could not generate draft. Please try again.');
      return;
    }

    currentDraft = data.draft;
    currentPreset = data.preset || {};
    renderDraftEditors(currentDraft);

    const recLimit = Number(currentPreset.resourceLimit || 0);
    if (recLimit > 0) {
      const recResp = await api('POST', '/api/recommendations/preview', {
        goal,
        draft: currentDraft,
        limit: recLimit
      });
      if (recResp.data && recResp.data.success) {
        renderPreviewResources(recResp.data.results || []);
      } else {
        aiDraftResources.innerHTML = '<p class="goals-subtitle">Could not load preview recommendations.</p>';
      }
    } else {
      aiDraftResources.innerHTML = '<p class="goals-subtitle">Resource suggestions were set to none.</p>';
    }

    aiDraftSection.hidden = false;
  }

  async function saveAiGoal() {
    if (!currentDraft) {
      showAiError('Generate a draft before saving.');
      return;
    }
    const goal = collectGoalPayloadFromAiForm();
    const selectedResourceIds = Array.from(aiDraftResources.querySelectorAll('.ai-resource-checkbox:checked')).map((el) =>
      Number(el.value)
    );

    aiSaveBtn.disabled = true;
    const { res, data } = await api('POST', '/api/ai/goal-plan/save', {
      goal,
      draft: currentDraft,
      selected_resource_ids: selectedResourceIds
    });
    aiSaveBtn.disabled = false;

    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }

    if (data.error === 'insufficient_tokens') {
      tokenBalance = Number(data.balance) || 0;
      updateTokenDisplays();
      openPurchaseModal();
      return;
    }
    if (!data.success) {
      showAiError(data.error || 'Could not save AI goal.');
      return;
    }

    tokenBalance = Number(data.balance) || tokenBalance;
    updateTokenDisplays();
    closeAiModal();
    await loadGoals();
  }

  async function handlePurchase(packId) {
    tokenPurchaseMsg.textContent = '';
    const { res, data } = await api('POST', '/api/ai-tokens/purchase', { pack_id: packId });
    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    if (!data.success) {
      tokenPurchaseMsg.textContent = data.error || 'Could not grant tokens.';
      return;
    }
    tokenBalance = Number(data.balance) || tokenBalance;
    tokenPurchaseMsg.textContent = `Added ${data.added_tokens} tokens. New balance: ${tokenBalance}.`;
    updateTokenDisplays();
  }

  async function openEdit(goalId) {
    const { res, data } = await api('GET', `/api/goals/${goalId}`);
    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    if (!data.success || !data.goal) {
      showErr(data.error || 'Goal not found.');
      return;
    }
    const g = data.goal;
    manualTitleEl.textContent = 'Edit goal';
    goalIdInput.value = String(g.goal_id);
    titleInput.value = g.title || '';
    descInput.value = g.description || '';
    catInput.value = g.category || '';
    dateInput.value = g.target_date ? String(g.target_date).slice(0, 10) : '';
    manualModal.hidden = false;
    titleInput.focus();
  }

  openCreateBtn.addEventListener('click', openChooserModal);
  chooseManualBtn.addEventListener('click', () => {
    closeChooserModal();
    openManualCreate();
  });
  chooseAiBtn.addEventListener('click', () => {
    closeChooserModal();
    openAiModal();
  });
  chooserCancelBtn.addEventListener('click', closeChooserModal);
  chooserModal.addEventListener('click', (e) => {
    if (e.target === chooserModal) closeChooserModal();
  });

  manualCancelBtn.addEventListener('click', closeManualModal);
  manualModal.addEventListener('click', (e) => {
    if (e.target === manualModal) closeManualModal();
  });

  aiCancelBtn.addEventListener('click', closeAiModal);
  aiModal.addEventListener('click', (e) => {
    if (e.target === aiModal) closeAiModal();
  });
  aiForm?.addEventListener('submit', (e) => {
    // Prevent Enter-key default form submit; AI flow uses explicit buttons.
    e.preventDefault();
  });

  aiGenerateBtn.addEventListener('click', generateAiDraft);
  aiSaveBtn.addEventListener('click', saveAiGoal);

  tokenPurchaseCloseBtn.addEventListener('click', closePurchaseModal);
  purchaseModal.addEventListener('click', (e) => {
    if (e.target === purchaseModal) closePurchaseModal();
  });
  tokenPackButtons.forEach((button) => {
    button.addEventListener('click', () => handlePurchase(button.dataset.pack));
  });

  statusFilter?.addEventListener('change', renderFromCache);
  sortBy?.addEventListener('change', renderFromCache);

  manualForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = goalIdInput.value.trim();
    const payload = {
      title: titleInput.value.trim(),
      description: descInput.value.trim() || null,
      category: catInput.value.trim() || null,
      target_date: dateInput.value || null
    };
    const path = id ? `/api/goals/${id}` : '/api/goals';
    const method = id ? 'PUT' : 'POST';
    const { res, data } = await api(method, path, payload);
    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    if (!data.success) {
      showErr(data.error || 'Save failed.');
      return;
    }
    closeManualModal();
    await loadGoals();
  });

  const opened = new URLSearchParams(window.location.search).get('opened');
  Promise.all([loadGoals(), loadTokenBalance()]).then(() => {
    if (!opened) return;
    const id = Number(opened);
    if (!Number.isFinite(id)) return;
    const card = listEl.querySelector(`[data-id="${id}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('goal-card--highlight');
      setTimeout(() => card.classList.remove('goal-card--highlight'), 4000);
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('opened');
    window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
  });
})();
