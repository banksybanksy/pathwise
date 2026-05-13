/**
 * Why:
 *   This is where the implementation for the browse of resources like templates, workflows,
 *   and simple readable resources is at. This allows the user to search, and filter through
 *   all the resources. If user doesn't have any particular resource, they can use the re-
 *   commended resources.
 *
 * What:
 *   This will handle search query, uses filter states to give filtered results 
 *   (also updates URL query) and fetches search results back to the user. In addition to 
 *   that it loads the recommended results to users
 *
 * Where used:
 *   It is loaded/called by vertical-prototype/index.html which is really the browse page
 *
 * Notes:
 *   - The APIs it calls: 
 *        /api/search, 
 *        /api/me, 
 *        /api/recommendations.
 *   - This file expects the controls for the search/filters to be in index.html
 *   - Beside keyword searching, the filters include things like keyword, category, tag, 
 *     cost, and AI-enabled
 */

const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const categoryInput = document.getElementById("category");
const contentTypeInput = document.getElementById("contentType");
const skillAreaInput = document.getElementById("skillArea");
const costInput = document.getElementById("cost-filter");
const aiOnlyInput = document.getElementById("filter-ai-only");
const recommendedSection = document.getElementById("recommended-section");
const recommendedResults = document.getElementById("recommended-results");
const templateRecommendedSection = document.getElementById("template-recommended-section");
const templateRecommendedResults = document.getElementById("template-recommended-results");
const resultsEl = document.getElementById("results");
const applyFiltersBtn = document.querySelector(".btn-apply-filters");
const clearFiltersBtn = document.querySelector(".btn-clear-filters");
const tagCheckboxes = document.querySelectorAll('input[type="checkbox"][data-tag]');
// These shortcut buttons make the browse demo faster across more milestone themes.
const themeShortcuts = document.querySelectorAll(".theme-shortcut");
const queryRegex = /^[a-z0-9 ]{1,40}$/i;

// Escape text before inserting it into cards so search results render safely.
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Reuse the same loading cards so searching feels responsive.
function loadingCardsMarkup(count = 6) {
  return Array.from({ length: count }).map(() => `
    <div class="result-card result-card--skeleton">
      <div class="skeleton-block skeleton-title"></div>
      <div class="skeleton-block skeleton-line"></div>
      <div class="skeleton-block skeleton-line skeleton-line--short"></div>
    </div>
  `).join("");
}

// Use one shared empty-state pattern instead of plain paragraphs.
function emptyStateMarkup(title, body) {
  return `
    <div class="results-empty">
      <p class="results-empty__title">${escapeHtml(title)}</p>
      <p class="results-empty__body">${escapeHtml(body)}</p>
    </div>
  `;
}

// This helper keeps the result cards readable even when values come from the API.
function resourceCardMarkup(resource) {
  const id = resource.resource_id || resource.id;
  const type = resource.content_type || "resource";
  let detailsHref = type === "resource" ? `resource.html?id=${id}` : "templates.html";
  if (type === "goal_template") detailsHref = `templates.html?id=${id}`;
  else if (type === "template" || type === "workflow") detailsHref = "templates.html";
  const badge = type !== "resource"
    ? `<p class="result-card-badge">${escapeHtml(type.replace("_", " "))}</p>`
    : Number(resource.is_ai_enabled)
      ? '<p class="result-card-badge">AI-enabled</p>'
      : "";
  return `
    <div class="result-card">
      <h3><a href="${detailsHref}">${escapeHtml(resource.title)}</a></h3>
      <p>${escapeHtml(resource.description || "")}</p>
      ${badge}
      <div class="result-card-actions">
        <a href="${detailsHref}" class="btn btn-secondary result-card-link">View Details</a>
      </div>
    </div>
  `;
}

function getSelectedTags() {
  return Array.from(tagCheckboxes)
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);
}

function updateUrl(params) {
  const queryString = params.toString();
  const nextUrl = queryString ? `?${queryString}` : window.location.pathname;
  history.replaceState(null, "", nextUrl);
}

// Keep the active theme visible so presenters can show what path they are browsing.
function setActiveTheme(button) {
  themeShortcuts.forEach((item) => {
    item.classList.toggle("is-active", item === button);
  });
}

function resetFilters() {
  searchInput.value = "";
  categoryInput.value = "";
  if (contentTypeInput) contentTypeInput.value = "";
  if (skillAreaInput) skillAreaInput.value = "";
  if (costInput) costInput.value = "";
  if (aiOnlyInput) aiOnlyInput.checked = false;
  setActiveTheme(null);

  // Reset all sidebar filters back to the default state.
  tagCheckboxes.forEach((checkbox) => {
    checkbox.checked = false;
  });
}

// Recommendation sections reuse the same state patterns as the main results area.
async function loadRecommendations() {
  if (!recommendedSection || !recommendedResults) return;

  try {
    const meResponse = await fetch("/api/me", { credentials: "include" });
    if (!meResponse.ok) {
      recommendedSection.hidden = true;
      return;
    }

    recommendedSection.hidden = false;
    recommendedResults.innerHTML = loadingCardsMarkup(3);

    const recResponse = await fetch("/api/recommendations?limit=4", { credentials: "include" });
    const recData = await recResponse.json();
    if (!recResponse.ok || !recData.success) {
      throw new Error(recData.error || "Could not load recommendations.");
    }

    if (!Array.isArray(recData.results) || recData.results.length === 0) {
      recommendedResults.innerHTML = emptyStateMarkup(
        "No recommendations yet",
        "Add goals or projects first so Pathwise has more context for suggestions."
      );
      return;
    }

    recommendedResults.innerHTML = recData.results.map((resource) => resourceCardMarkup(resource)).join("");
  } catch (_) {
    recommendedSection.hidden = true;
  }
}

// Template cards follow the same safe rendering rules as the rest of browse.
function templateCardMarkup(template) {
  const tid = template.goal_id || template.template_id;
  const href = tid ? `templates.html?id=${tid}` : "templates.html";
  return `
    <div class="result-card">
      <h3><a href="${href}">${escapeHtml(template.title)}</a></h3>
      <p>${escapeHtml(template.description || "")}</p>
      <p class="result-card-badge">goal template</p>
      <div class="result-card-actions">
        <a href="${href}" class="btn btn-secondary result-card-link">View</a>
      </div>
    </div>
  `;
}

// Keep template recommendations visually aligned with search results.
async function loadTemplateRecommendations() {
  if (!templateRecommendedSection || !templateRecommendedResults) return;
  try {
    const meResponse = await fetch("/api/me", { credentials: "include" });
    if (!meResponse.ok) {
      templateRecommendedSection.hidden = true;
      return;
    }
    templateRecommendedSection.hidden = false;
    templateRecommendedResults.innerHTML = loadingCardsMarkup(3);
    const response = await fetch("/api/template-recommendations?limit=4", { credentials: "include" });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error("Could not load template recommendations.");
    if (!Array.isArray(data.results) || data.results.length === 0) {
      templateRecommendedResults.innerHTML = emptyStateMarkup(
        "No template recommendations yet",
        "Once your activity grows, this section will suggest goal templates to explore."
      );
      return;
    }
    templateRecommendedResults.innerHTML = data.results.map((t) => templateCardMarkup(t)).join("");
  } catch (_) {
    templateRecommendedSection.hidden = true;
  }
}

// The search flow now shares loading and empty states so it feels steadier.
async function runSearch(event) {
  event.preventDefault();
  const q = searchInput.value.trim();
  const category = categoryInput.value;
  const contentType = contentTypeInput?.value || "";
  const skillArea = skillAreaInput?.value.trim() || "";

  resultsEl.innerHTML = loadingCardsMarkup();

  if (q && !queryRegex.test(q)) {
    resultsEl.innerHTML = emptyStateMarkup(
      "Search format not supported",
      "Use 1 to 40 letters, numbers, and spaces only."
    );
    return;
  }

  try {
    const params = new URLSearchParams();
    const selectedTags = getSelectedTags();
    const cost = costInput?.value || "";

    if (q) params.append("q", q);
    if (category) params.append("category", category);
    if (contentType) params.append("type", contentType);
    if (skillArea) params.append("skill_area", skillArea);
    if (selectedTags.length > 0) params.append("tags", selectedTags.join(","));
    if (cost) params.append("cost", cost);
    if (aiOnlyInput && aiOnlyInput.checked) params.append("ai", "1");

    updateUrl(params);

    const response = await fetch(`/api/search?${params.toString()}`);
    const data = await response.json();

    if (!data.success) {
      resultsEl.innerHTML = emptyStateMarkup(
        "Search could not finish",
        data.error || "Please try another search."
      );
      return;
    }

    if (data.results.length === 0) {
      resultsEl.innerHTML = emptyStateMarkup(
        "No matches yet",
        "Try a broader keyword or remove one of the filters."
      );
      return;
    }

    resultsEl.innerHTML = data.results.map((resource) => resourceCardMarkup(resource)).join("");
  } catch (error) {
    resultsEl.innerHTML = emptyStateMarkup(
      "Search could not finish",
      error.message || "Please try again."
    );
  }
}

searchForm.addEventListener("submit", runSearch);

if (costInput) {
  costInput.addEventListener("change", () => {
    searchForm.dispatchEvent(new Event("submit"));
  });
}

tagCheckboxes.forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    searchForm.dispatchEvent(new Event("submit"));
  });
});

if (aiOnlyInput) {
  aiOnlyInput.addEventListener("change", () => {
    searchForm.dispatchEvent(new Event("submit"));
  });
}

if (applyFiltersBtn) {
  applyFiltersBtn.addEventListener("click", () => {
    searchForm.dispatchEvent(new Event("submit"));
  });
}

if (clearFiltersBtn) {
  clearFiltersBtn.addEventListener("click", () => {
    resetFilters();
    updateUrl(new URLSearchParams());
    // After clearing filters, reload the full catalog so Browse always has content ready.
    searchForm.dispatchEvent(new Event("submit"));
  });
}

const pageParams = new URLSearchParams(window.location.search);
if (pageParams.get("q")) searchInput.value = pageParams.get("q");
if (pageParams.get("category")) categoryInput.value = pageParams.get("category");
if (pageParams.get("type") && contentTypeInput) contentTypeInput.value = pageParams.get("type");
if (pageParams.get("skill_area") && skillAreaInput) skillAreaInput.value = pageParams.get("skill_area");
if (pageParams.get("cost") && costInput) costInput.value = pageParams.get("cost");
if (pageParams.get("ai") === "1" && aiOnlyInput) aiOnlyInput.checked = true;
if (pageParams.get("tags")) {
  const tags = pageParams.get("tags").split(",").map((value) => value.trim());
  tagCheckboxes.forEach((checkbox) => {
    checkbox.checked = tags.includes(checkbox.value);
  });
}

// These shortcuts speed up demo browsing for milestone themes like leadership and research.
themeShortcuts.forEach((button) => {
  button.addEventListener("click", () => {
    resetFilters();
    const themeQuery = button.dataset.themeQuery || "";
    const themeCategory = button.dataset.themeCategory || "";
    searchInput.value = themeQuery;
    if (themeCategory) {
      categoryInput.value = themeCategory;
    }
    if (skillAreaInput && themeQuery) {
      skillAreaInput.value = themeQuery.toLowerCase();
    }
    setActiveTheme(button);
    searchForm.dispatchEvent(new Event("submit"));
  });
});

// Load all approved resources on first visit so the page behaves like a browse experience right away.
searchForm.dispatchEvent(new Event("submit"));

loadRecommendations();
loadTemplateRecommendations();
