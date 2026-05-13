------------------------------------------------------------------------------------------

-- Why:
--   This is needed for adding one of the features we promised which
--   is journaling and activity tracking across meaningful set of pages
--   so Pathwise can support activity summaries and reflection entries.
--
-- What:
--   It creates the Reflections and ActivityLogs tables with foreign keys 
--   to link to the users and the planning nested layer of componenets.
--
-- Where used:
--   It is supports the reflection page, and profile activity feeds.
--
-- Notes:
--   - Run this after the schema for goals and projects exist as well as 
--     Users table
--   - This is safe for one-time migration on an existing Pathwise DB.
--   - The table it touches: 
--        Reflections, 
--        ActivityLogs.
--
------------------------------------------------------------------------------------------

-- Pathwise: reflections journal + activity audit trail

CREATE TABLE IF NOT EXISTS Reflections (
  reflection_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  body TEXT NOT NULL,
  goal_id INT NULL DEFAULT NULL,
  project_id INT NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (reflection_id),
  KEY idx_reflections_user (user_id),
  CONSTRAINT fk_reflections_user FOREIGN KEY (user_id) REFERENCES Users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_reflections_goal FOREIGN KEY (goal_id) REFERENCES Goals (goal_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_reflections_project FOREIGN KEY (project_id) REFERENCES Projects (project_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ActivityLogs (
  log_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NULL DEFAULT NULL,
  action_type VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NULL DEFAULT NULL,
  entity_id INT NULL DEFAULT NULL,
  detail TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  KEY idx_activity_user_created (user_id, created_at),
  CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES Users (user_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
