------------------------------------------------------------------------------------------

-- Why:
--   This is needed to support the main planning data model for our 
--   vertical protoype: like goals, projects, milestones, and resource 
--   attachements
--
-- What:
--   This sql basically creates Goals, Projects, Milestones, GoalResources, 
--   and ProjectsResources with foregin keys used across the tables to link
--   the chain of relationships needed for structured and correct planning
--
-- Where used:
--   It helps teh backend routes such as goal, project, and milestone and 
--   the goals and goal hub pages.
--
-- Notes:
--   - Run this sql schema after 001_m3_users_bookmarks.sql
--   - This is safe for where the Users and Resources table already exist on their system
--   - The table it touches: 
--        Goals, 
--        Projects, 
--        Milestones, 
--        GoalResources, 
--        ProjectResources.
--

------------------------------------------------------------------------------------------

-- Pathwise M3: Goals / Projects / Milestones + resource attachments

CREATE TABLE IF NOT EXISTS Goals (
  goal_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  category VARCHAR(100) NULL,
  target_date DATE NULL,
  status ENUM('active', 'paused', 'completed') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (goal_id),
  KEY idx_goals_user (user_id),
  CONSTRAINT fk_goals_user FOREIGN KEY (user_id) REFERENCES Users (user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Projects (
  project_id INT NOT NULL AUTO_INCREMENT,
  goal_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id),
  KEY idx_projects_goal (goal_id),
  CONSTRAINT fk_projects_goal FOREIGN KEY (goal_id) REFERENCES Goals (goal_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Milestones (
  milestone_id INT NOT NULL AUTO_INCREMENT,
  project_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  target_date DATE NULL,
  is_completed TINYINT(1) NOT NULL DEFAULT 0,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (milestone_id),
  KEY idx_milestones_project (project_id),
  CONSTRAINT fk_milestones_project FOREIGN KEY (project_id) REFERENCES Projects (project_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS GoalResources (
  goal_id INT NOT NULL,
  resource_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (goal_id, resource_id),
  CONSTRAINT fk_goal_resources_goal FOREIGN KEY (goal_id) REFERENCES Goals (goal_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_goal_resources_resource FOREIGN KEY (resource_id) REFERENCES Resources (resource_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ProjectResources (
  project_id INT NOT NULL,
  resource_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, resource_id),
  CONSTRAINT fk_project_resources_project FOREIGN KEY (project_id) REFERENCES Projects (project_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_project_resources_resource FOREIGN KEY (resource_id) REFERENCES Resources (resource_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
