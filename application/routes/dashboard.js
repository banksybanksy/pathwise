/**
 * Why:
 *   This file is meant to provide a single unified dashboard endpoint so 
 *   we can render an overview of the students current planning, resources, and possibly
 *   add recent messages. 
 *
 * What:
 *   It defines the routes that loads the goals, projects, milestones, and saved resources
 *   for the user in mind, and returns in JSON.
 *
 * Where used:
 *   It is mounted under '/api' in server.js
 *   It is called by vertical-prototype/js/dashboard.js
 *
 * Notes:
 *   - It expects an authenticated session
 *   - For the data loading it gives it to controllers/dashboardController.js.
 * 
 * TODO:
 *   - Since this will be the dashboard is a unified look into the user information, we
 *     could possibly add recent messages, as well as templates, and workflows materials
 */

const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { loadDashboardData } = require('../controllers/dashboardController');

const router = express.Router();

router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const { goals, projects, milestones, savedResources } = await loadDashboardData(req.session.userId);
    res.json({ success: true, goals, projects, milestones, savedResources });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
