# Pathwise

Pathwise is a student success platform for organizing academic goals, projects, milestones, and campus resources in one workflow. It began as a team capstone project for SFSU CSC 648/848, and this branch is a trimmed portfolio version focused on the core product code.

The product direction was simple: give students a practical place to turn vague goals into structured plans, connect those plans to useful resources, and keep the experience trustworthy enough for an academic setting.

## Portfolio Context

This repository originated as a shared class project owned by the SFSU course organization. This version removes course-submission artifacts, credentials, and team bio pages so the repo reads as a focused engineering case study. It is presented as a personal showcase of my contributions and judgment, not as a claim of sole authorship.

**My role:** full-stack engineer with a frontend/platform focus  
**Team:** 7 students  
**Timeline:** Spring 2026  
**Primary contribution areas:** product UI, routing, authenticated flows, resource discovery, admin moderation, responsive polish, and integration work across frontend/backend boundaries

## What It Does

- Helps students create and manage goals, projects, and milestones.
- Lets users browse, search, filter, save, rate, and share academic/career resources.
- Provides personalized recommendations based on a student's goals, projects, saved resources, and profile signals.
- Supports AI-assisted goal planning with token limits, draft validation, and structured save flows.
- Includes reflections and activity logging so students can review progress over time.
- Gives admin users a moderation surface for reviewing submitted resources.
- Uses role-aware navigation and protected routes for student/admin experiences.

## Why It Matters

For companies building AI and productivity products, the interesting part of Pathwise is not just that it has CRUD screens. The project touches problems that show up in real systems:

- turning ambiguous user intent into structured workflows
- designing AI assistance with constraints, validation, and fallback behavior
- keeping personalized recommendations useful without overcomplicating the first version
- separating public, private, submitted, approved, and rejected content states
- making a student-facing product feel calm, reliable, and usable under demo pressure

## Technical Stack

- **Frontend:** HTML, CSS, vanilla JavaScript
- **Backend:** Node.js, Express
- **Database:** MySQL with incremental SQL migrations
- **Auth:** Express sessions, bcrypt password hashing, role-aware middleware
- **AI integration:** Google Gemini API through `@google/generative-ai`
- **Testing:** Jest and Supertest smoke/integration coverage
- **Deployment target:** AWS EC2/RDS style environment with Nginx proxy config

## System Shape

```text
Browser UI
  |
  | static pages + fetch()
  v
Express server
  |
  | mounted /api route modules
  v
MySQL database
  |
  | migrations + seed data
  v
Goals, projects, milestones, resources, reflections, shares, ratings, messages
```

Important folders:

- `application/server.js` - Express app entry point and route mounting.
- `application/routes/` - API modules for auth, goals, resources, recommendations, admin, reports, and more.
- `application/services/` - shared services for AI plan generation, activity logging, and recommendation previews.
- `application/vertical-prototype/` - student-facing frontend pages, styles, and client-side behavior.
- `application/db/migrations/` - ordered MySQL schema evolution and fresh database bootstrap.
- `application/tests/` - Jest/Supertest smoke coverage for key API expectations.
- `config/` - deployment support such as the Nginx API proxy example.
- `docs/` - lightweight engineering standards used during implementation.

## Selected Engineering Work

### Product and Frontend

- Built and refined the vertical prototype navigation, landing, auth, dashboard, templates, bookmarks, profile, and resource flows.
- Added role-aware route behavior and guest/auth/admin navigation states.
- Improved mobile responsiveness across key screens so the demo worked across narrow and desktop layouts.
- Designed the CSS structure around reusable variables, layout rules, and component styles rather than page-only one-offs.
- Polished error, empty, and loading states for search, recommendations, and authenticated pages.

### Backend Integration

- Connected frontend pages to Express APIs for search, bookmarks, profiles, dashboards, goals, templates, and recommendations.
- Helped wire protected routes and auth gating so private actions require an active session.
- Added or integrated API behavior for resource discovery, recommendations, admin moderation, reports, AI goal planning, and reflection flows.
- Kept route modules separate enough to make the growing demo surface understandable under a class-team workflow.

### AI and Recommendation UX

- Supported the AI goal-plan flow where user answers are transformed into a structured draft with projects, milestones, and optional resource suggestions.
- Added validation/sanitization around AI-generated plan data before saving.
- Kept recommendations explainable through goal/project/resource text matching and fallback behavior, rather than relying on opaque ranking alone.
- Preserved token accounting for AI usage so the feature had a visible product constraint.

### Release Readiness

- Helped stabilize final routing, 404 behavior, admin views, and frontend polish.
- Added smoke tests for public search and protected endpoints.
- Removed non-product artifacts from this portfolio branch so reviewers can scan the implementation without course assignment noise.

## Running Locally

From the repo root:

```bash
npm install --prefix application
cp application/.env.example application/.env
npm start
```

The app defaults to `http://localhost:3000`.

To run the backend smoke tests:

```bash
npm --prefix application test
```

For a fresh database, run the master migration from `application/db/migrations`:

```bash
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p "$DB_NAME" < application/db/migrations/masterMigration.sql
```

Then optionally seed demo data:

```bash
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p "$DB_NAME" < application/db/migrations/003_m3_seed_demo.sql
```

## Environment

Create `application/.env` from `application/.env.example`.

Required:

```bash
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-password
DB_NAME=pathwise
SESSION_SECRET=replace-with-a-long-random-string
```

Optional:

```bash
PORT=3000
COOKIE_SECURE=true
GEMINI_API_KEY=your-key
```

## Portfolio Cleanup

This branch intentionally excludes:

- course milestone PDFs and assignment placeholders
- team biography pages and personal media from early coursework
- local IDE metadata
- shared credentials and deployment keys
- generated dependency folders

The production/demo environment depended on course infrastructure and team-owned credentials, so this portfolio version focuses on codebase quality, architecture, and local reproducibility.

## Attribution

Pathwise was developed by Team 02 for SFSU CSC 648/848 Spring 2026:

- Omeid Nadery
- Mikias Berhane
- Cielina Lubrino
- Laura Wong
- Brandon Sanchez
- Damian Perez
- Jason Le

This portfolio branch highlights Damian Perez's work and prepares the project for review by technical recruiters and engineering teams while preserving the original team context.
