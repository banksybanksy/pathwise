-- Why:
--   Adds many-to-many linking between Reflections and the user's Goals, Projects,
--   and Milestones so users do not have to type raw database IDs.
--
-- What:
--   Creates ReflectionGoals, ReflectionProjects, and ReflectionMilestones join tables.
--
-- Where used:
--   Used by routes/reflections.js and vertical-prototype/js/reflections.js.
--
-- Notes:
--   - Run after Reflections, Goals, Projects, and Milestones exist.
--   - Keeps old Reflections.goal_id and Reflections.project_id columns for backward compatibility.

CREATE TABLE IF NOT EXISTS ReflectionGoals (
  reflection_id INT NOT NULL,
  goal_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (reflection_id, goal_id),
  CONSTRAINT fk_reflection_goals_reflection
    FOREIGN KEY (reflection_id) REFERENCES Reflections (reflection_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_reflection_goals_goal
    FOREIGN KEY (goal_id) REFERENCES Goals (goal_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ReflectionProjects (
  reflection_id INT NOT NULL,
  project_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (reflection_id, project_id),
  CONSTRAINT fk_reflection_projects_reflection
    FOREIGN KEY (reflection_id) REFERENCES Reflections (reflection_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_reflection_projects_project
    FOREIGN KEY (project_id) REFERENCES Projects (project_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ReflectionMilestones (
  reflection_id INT NOT NULL,
  milestone_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (reflection_id, milestone_id),
  CONSTRAINT fk_reflection_milestones_reflection
    FOREIGN KEY (reflection_id) REFERENCES Reflections (reflection_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_reflection_milestones_milestone
    FOREIGN KEY (milestone_id) REFERENCES Milestones (milestone_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;