const { GoogleGenerativeAI } = require('@google/generative-ai');

const TOKEN_COST_PER_SAVE = 1;

const QUESTION_KEYS = [
  'weekly_time',
  'work_organization',
  'milestone_granularity',
  'resource_suggestions',
  'deadline_firmness'
];

const OPTIONS = {
  weekly_time: ['lt5', '5to10', '10to20', 'gt20'],
  work_organization: ['one_track', 'balanced', 'many_tracks'],
  milestone_granularity: ['bigger', 'standard', 'smaller'],
  resource_suggestions: ['none', 'few', 'more'],
  deadline_firmness: ['rough', 'firm', 'hard']
};

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeString(value, maxLen = 255) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, maxLen);
}

function mapPreset(answers) {
  const byTime = {
    lt5: { projectMin: 2, projectMax: 2, milestoneMin: 2, milestoneMax: 3 },
    '5to10': { projectMin: 2, projectMax: 3, milestoneMin: 3, milestoneMax: 4 },
    '10to20': { projectMin: 3, projectMax: 4, milestoneMin: 3, milestoneMax: 5 },
    gt20: { projectMin: 4, projectMax: 5, milestoneMin: 4, milestoneMax: 6 }
  };

  const preset = { ...byTime[answers.weekly_time] };

  if (answers.work_organization === 'one_track') {
    preset.projectMax = Math.max(1, preset.projectMax - 1);
  } else if (answers.work_organization === 'many_tracks') {
    preset.projectMin += 1;
    preset.projectMax += 1;
  }

  if (answers.milestone_granularity === 'bigger') {
    preset.milestoneMax = Math.max(2, preset.milestoneMax - 1);
  } else if (answers.milestone_granularity === 'smaller') {
    preset.milestoneMin += 1;
    preset.milestoneMax += 1;
  }

  let resourceLimit = 0;
  if (answers.resource_suggestions === 'few') resourceLimit = 3;
  if (answers.resource_suggestions === 'more') resourceLimit = 6;

  const paceHint = {
    rough: 'Use flexible pacing with room for shifts.',
    firm: 'Use balanced pacing with clear checkpoints.',
    hard: 'Use deadline-first pacing and avoid schedule slip.'
  }[answers.deadline_firmness];

  return {
    projectMin: Math.min(preset.projectMin, 5),
    projectMax: Math.min(Math.max(preset.projectMin, preset.projectMax), 6),
    milestoneMin: Math.min(preset.milestoneMin, 6),
    milestoneMax: Math.min(Math.max(preset.milestoneMin, preset.milestoneMax), 7),
    resourceLimit,
    paceHint
  };
}

function validateQuestionnaire(raw) {
  const answers = raw && typeof raw === 'object' ? raw : {};
  const cleaned = {};
  for (const key of QUESTION_KEYS) {
    const value = normalizeString(answers[key], 60);
    if (!value || !OPTIONS[key].includes(value)) {
      throw new Error(`Invalid questionnaire option: ${key}`);
    }
    cleaned[key] = value;
  }
  return cleaned;
}

function validateGoalInput(rawGoal) {
  const goal = rawGoal && typeof rawGoal === 'object' ? rawGoal : {};
  const title = normalizeString(goal.title, 255);
  const description = normalizeString(goal.description, 2000);
  const category = normalizeString(goal.category, 100);
  const targetDate = goal.target_date ? String(goal.target_date).slice(0, 10) : null;

  if (!title || title.length < 2) {
    throw new Error('Goal title is required (min 2 chars).');
  }
  if (targetDate && !isIsoDate(targetDate)) {
    throw new Error('Goal target_date must be YYYY-MM-DD.');
  }

  return {
    title,
    description: description || null,
    category: category || null,
    target_date: targetDate
  };
}

function sanitizePlanDraft(rawPlan, targetDate, preset) {
  if (!rawPlan || typeof rawPlan !== 'object') {
    throw new Error('AI response must be an object.');
  }
  const projectsRaw = Array.isArray(rawPlan.projects) ? rawPlan.projects : [];
  if (!projectsRaw.length) throw new Error('AI response includes no projects.');

  const projects = projectsRaw.slice(0, preset.projectMax).map((project) => {
    const title = normalizeString(project && project.title, 255);
    const description = normalizeString(project && project.description, 1000);
    const milestonesRaw = Array.isArray(project && project.milestones) ? project.milestones : [];
    const milestones = milestonesRaw.slice(0, preset.milestoneMax).map((milestone) => {
      const mTitle = normalizeString(milestone && milestone.title, 255);
      const mDesc = normalizeString(milestone && milestone.description, 1000);
      let mDate = milestone && milestone.target_date ? String(milestone.target_date).slice(0, 10) : null;
      if (mDate && !isIsoDate(mDate)) mDate = null;
      if (targetDate && mDate && mDate > targetDate) mDate = targetDate;
      return {
        title: mTitle || 'Milestone',
        description: mDesc || null,
        target_date: mDate
      };
    });

    return {
      title: title || 'Project',
      description: description || null,
      milestones
    };
  });

  const filteredProjects = projects.filter((project) => project.milestones.length > 0);
  if (!filteredProjects.length) {
    throw new Error('AI response produced no milestones.');
  }
  if (filteredProjects.length < preset.projectMin) {
    throw new Error('AI response produced too few projects.');
  }
  for (const project of filteredProjects) {
    if (project.milestones.length < preset.milestoneMin) {
      throw new Error('AI response produced too few milestones.');
    }
  }

  return {
    plan_summary: normalizeString(rawPlan.plan_summary, 1200) || 'AI-generated plan draft.',
    projects: filteredProjects
  };
}

function buildPrompt(goal, answers, preset) {
  return [
    'You are generating a practical goal execution plan for a student product called Pathwise.',
    'Return valid JSON only with this exact schema:',
    '{"plan_summary":"string","projects":[{"title":"string","description":"string|null","milestones":[{"title":"string","description":"string|null","target_date":"YYYY-MM-DD|null"}]}]}',
    `Create between ${preset.projectMin} and ${preset.projectMax} projects.`,
    `Each project must have between ${preset.milestoneMin} and ${preset.milestoneMax} milestones.`,
    `Do not create milestone dates after ${goal.target_date || 'the goal timeline'}.`,
    preset.paceHint,
    'Use concise, student-friendly language and realistic sequencing.',
    `Goal title: ${goal.title}`,
    `Goal description: ${goal.description || 'n/a'}`,
    `Goal category: ${goal.category || 'n/a'}`,
    `Goal target date: ${goal.target_date || 'n/a'}`,
    `Questionnaire answers: ${JSON.stringify(answers)}`
  ].join('\n');
}

async function generateDraftWithGemini(goal, answers, preset) {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL;
  if (!apiKey || !modelName) {
    throw new Error('Gemini is not configured. Missing GEMINI_API_KEY or GEMINI_MODEL.');
  }
  const maxOutputTokens = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS || 1800);

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens,
      responseMimeType: 'application/json'
    }
  });

  const result = await model.generateContent(buildPrompt(goal, answers, preset));
  const text = result.response.text();
  
  // TEMP DEBUG: inspect model output when JSON parse fails
  console.log('[ai-goal][gemini-raw]', text);
  console.log('[ai-goal][gemini-raw-length]', text.length);
  
  let json;
  try {
    json = JSON.parse(text);
  } catch (_err) {
    console.log('[ai-goal][gemini-raw-head]', text.slice(0, 300));
    console.log('[ai-goal][gemini-raw-tail]', text.slice(-300));
    throw new Error('Gemini did not return valid JSON.');
  }  return sanitizePlanDraft(json, goal.target_date, preset);
}

function validateSavePayload(rawBody) {
  const body = rawBody && typeof rawBody === 'object' ? rawBody : {};
  const goal = validateGoalInput(body.goal || {});
  const draft = sanitizePlanDraft(body.draft || {}, goal.target_date, {
    projectMin: 1,
    projectMax: 8,
    milestoneMin: 1,
    milestoneMax: 12
  });
  const selectedResourceIds = Array.isArray(body.selected_resource_ids)
    ? body.selected_resource_ids
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v) && v > 0)
    : [];

  return { goal, draft, selectedResourceIds };
}

module.exports = {
  TOKEN_COST_PER_SAVE,
  QUESTION_KEYS,
  OPTIONS,
  validateGoalInput,
  validateQuestionnaire,
  mapPreset,
  generateDraftWithGemini,
  validateSavePayload
};
