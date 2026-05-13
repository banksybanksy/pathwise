/**
 * Why:
 *   This file implements the dashboard page so users can see all their goals, projects,
 *   milestones as well as their resources and so on in one place without having the user
 *   go to each page to gather the informations.
 *
 * What:
 *   After it fetches the dashboard, it does simple computation to figure out the progress
 *   and render summaries as well as data tables.
 *
 * Where used:
 *   It is loaded/called by vertical-prototype/dashboard.html.
 *
 * Notes:
 *   - The APIs it calls: 
 *       /api/dashboard, 
 *       /api/recommendations.
 *   - As usual, we redirect user to the login.html on 401
 *   - It expects #dashboard-content to exist in the dashboard html page so it can properly
 *     showcase all the computed results.
 */

(async function loadDashboard() {
  const root = document.getElementById("dashboard-content");
  const activeGoalsCount = document.getElementById("active-goals-count");
  const projectsCount = document.getElementById("projects-count");
  const milestonesCount = document.getElementById("milestones-count");
  const savedCount = document.getElementById("saved-count");
  const progressBar = document.getElementById("dashboard-progress-bar");
  const progressText = document.getElementById("dashboard-progress-text");
  const goalsTableBody = document.getElementById("goals-table-body");
  const projectsTableBody = document.getElementById("projects-table-body");
  const milestonesTableBody = document.getElementById("milestones-table-body");
  const savedResourcesTableBody = document.getElementById("saved-resources-table-body");
  // These nodes power the lightweight report panel that now reads from /api/reports/summary.
  const reportRange = document.getElementById("report-range");
  const reportRangeLabel = document.getElementById("report-range-label");
  const reportHighlights = document.getElementById("report-highlights");
  const reportCompletedGoals = document.getElementById("report-completed-goals");
  const reportReflections = document.getElementById("report-reflections");
  const reportSaved = document.getElementById("report-saved");
  const reportActivity = document.getElementById("report-activity");
  const reportValueMap = {
    completedGoals: {
      valueEl: document.getElementById("report-completed-goals"),
      labelEl: document.getElementById("report-completed-goals-label"),
      barEl: document.getElementById("report-completed-goals-bar")
    },
    activeGoals: {
      valueEl: null,
      labelEl: document.getElementById("report-active-goals-label"),
      barEl: document.getElementById("report-active-goals-bar")
    },
    completedMilestones: {
      valueEl: null,
      labelEl: document.getElementById("report-completed-milestones-label"),
      barEl: document.getElementById("report-completed-milestones-bar")
    },
    pendingMilestones: {
      valueEl: null,
      labelEl: document.getElementById("report-pending-milestones-label"),
      barEl: document.getElementById("report-pending-milestones-bar")
    }
  };

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(value) {
    return value ? esc(String(value).slice(0, 10)) : "—";
  }

  function setCount(element, value) {
    if (element) {
      element.textContent = value;
    }
  }

  function setTableRows(element, markup) {
    if (element) {
      element.innerHTML = markup;
    }
  }

  // Convert report timestamps into a shorter dashboard-friendly label.
  function formatDateTime(value) {
    if (!value) return "Recently";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return esc(String(value).slice(0, 10));
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  // Give the report panel a simple readable label for the selected time range.
  function rangeLabel(range) {
    if (range === "semester") return "Semester activity";
    if (range === "monthly") return "Last 30 days";
    return "Last 7 days";
  }

  // Keep the report bars proportional without adding a chart dependency.
  function setReportMetric(key, value, maxValue) {
    const config = reportValueMap[key];
    if (!config) return;
    const safeValue = Number(value) || 0;
    const width = maxValue > 0 ? Math.max(8, Math.round((safeValue / maxValue) * 100)) : 0;
    if (config.valueEl) config.valueEl.textContent = safeValue;
    if (config.labelEl) config.labelEl.textContent = safeValue;
    if (config.barEl) config.barEl.style.width = `${width}%`;
  }

  // Load the reporting endpoint separately so the main dashboard still works if reporting is unavailable.
  async function loadReports(range = "weekly") {
    if (!reportRangeLabel || !reportHighlights) return;

    reportRangeLabel.textContent = `Loading ${rangeLabel(range).toLowerCase()}...`;
    reportHighlights.innerHTML = `
      <li class="dashboard-report-highlights__item">
        <span class="dashboard-report-highlights__action">Loading report activity...</span>
      </li>`;

    try {
      const response = await fetch(`/api/reports/summary?range=${encodeURIComponent(range)}`, {
        credentials: "include"
      });
      if (response.status === 401) {
        window.location.href = "login.html";
        return;
      }

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not load report summary.");
      }

      if (reportCompletedGoals) reportCompletedGoals.textContent = data.completedGoals ?? 0;
      if (reportReflections) reportReflections.textContent = data.reflectionsCount ?? 0;
      if (reportSaved) reportSaved.textContent = data.resourcesSaved ?? 0;
      if (reportActivity) reportActivity.textContent = data.activityCount ?? 0;
      reportRangeLabel.textContent = rangeLabel(data.range || range);

      const maxValue = Math.max(
        1,
        Number(data.completedGoals) || 0,
        Number(data.activeGoals) || 0,
        Number(data.completedMilestones) || 0,
        Number(data.pendingMilestones) || 0
      );
      setReportMetric("completedGoals", data.completedGoals, maxValue);
      setReportMetric("activeGoals", data.activeGoals, maxValue);
      setReportMetric("completedMilestones", data.completedMilestones, maxValue);
      setReportMetric("pendingMilestones", data.pendingMilestones, maxValue);

      const highlights = Array.isArray(data.recentHighlights) ? data.recentHighlights : [];
      reportHighlights.innerHTML = highlights.length
        ? highlights.map((item) => `
            <li class="dashboard-report-highlights__item">
              <span class="dashboard-report-highlights__action">${esc((item.action_type || "activity").replace(/_/g, " "))}</span>
              <span class="dashboard-report-highlights__time">${esc(formatDateTime(item.created_at))}</span>
            </li>
          `).join("")
        : `
            <li class="dashboard-report-highlights__item">
              <span class="dashboard-report-highlights__action">No report activity yet</span>
              <span class="dashboard-report-highlights__time">Try again after using the app more.</span>
            </li>`;
    } catch (error) {
      reportRangeLabel.textContent = "Report summary unavailable";
      reportHighlights.innerHTML = `
        <li class="dashboard-report-highlights__item">
          <span class="dashboard-report-highlights__action">${esc(error.message || "Could not load report summary.")}</span>
        </li>`;
    }
  }

  try {
    const response = await fetch("/api/dashboard", { credentials: "include" });
    if (response.status === 401) {
      window.location.href = "login.html";
      return;
    }

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Failed to load dashboard");
    }

    const goals = data.goals || [];
    const projects = data.projects || [];
    const milestones = data.milestones || [];
    const savedResources = data.savedResources || [];

    const completedMilestones = milestones.filter((milestone) => milestone.is_completed).length;
    const activeGoals = goals.filter((goal) => goal.status === "active").length;
    const progressPercent = milestones.length
      ? Math.round((completedMilestones / milestones.length) * 100)
      : 0;

    // Update the top summary cards without rebuilding the whole layout.
    setCount(activeGoalsCount, activeGoals);
    setCount(projectsCount, projects.length);
    setCount(milestonesCount, `${completedMilestones}/${milestones.length}`);
    setCount(savedCount, savedResources.length);

    if (progressBar) {
      progressBar.style.width = `${progressPercent}%`;
    }
    if (progressText) {
      progressText.textContent = `${progressPercent}% milestone completion`;
    }

    const goalsRows = goals.length
      ? goals.map((goal) => `
          <tr>
            <td><a href="goal.html?id=${goal.goal_id}">${esc(goal.title)}</a></td>
            <td>${esc(goal.category || "—")}</td>
            <td>${esc(goal.status || "—")}</td>
            <td>${formatDate(goal.target_date)}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="4">No goals yet. <a href="goals.html">Create a goal</a>.</td></tr>`;

    const projectsRows = projects.length
      ? projects.map((project) => `
          <tr>
            <td>${esc(project.title)}</td>
            <td><a href="goal.html?id=${project.goal_id}">Goal #${esc(project.goal_id)}</a></td>
            <td>${formatDate(project.updated_at)}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="3">No projects yet.</td></tr>`;

    const milestonesRows = milestones.length
      ? milestones.map((milestone) => `
          <tr>
            <td>${esc(milestone.title)}</td>
            <td>Project #${esc(milestone.project_id)}</td>
            <td>${milestone.is_completed ? "Done" : "Open"}</td>
            <td>${formatDate(milestone.target_date)}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="4">No milestones yet.</td></tr>`;

    const savedRows = savedResources.length
      ? savedResources.map((resource) => `
          <tr>
            <td><a href="resource.html?id=${resource.resource_id}">${esc(resource.title)}</a></td>
            <td>${formatDate(resource.bookmarked_at)}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="2">No saved resources. <a href="index.html">Browse</a>.</td></tr>`;

    setTableRows(goalsTableBody, goalsRows);
    setTableRows(projectsTableBody, projectsRows);
    setTableRows(milestonesTableBody, milestonesRows);
    setTableRows(savedResourcesTableBody, savedRows);
    loadReports(reportRange?.value || "weekly");
  } catch (error) {
    root.innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }

  // Let demo presenters switch between short-term and semester views without leaving the page.
  if (reportRange) {
    reportRange.addEventListener("change", () => {
      loadReports(reportRange.value);
    });
  }
})();
