-- Pathwise M3: templates/workflows + attachment links
-- Oracle MySQL does not support "ADD COLUMN IF NOT EXISTS"; use a conditional ALTER.

SET @db := DATABASE();
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Resources' AND COLUMN_NAME = 'skill_area'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE Resources ADD COLUMN skill_area VARCHAR(100) NULL AFTER category_id',
  'SELECT 1'
);
PREPARE stmt_add_skill_area FROM @sql;
EXECUTE stmt_add_skill_area;
DEALLOCATE PREPARE stmt_add_skill_area;

CREATE TABLE IF NOT EXISTS CommunityTemplates (
  template_id INT NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  category VARCHAR(100) NULL,
  skill_area VARCHAR(100) NULL,
  workflow_steps TEXT NOT NULL,
  is_public TINYINT(1) NOT NULL DEFAULT 1,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  copied_count INT NOT NULL DEFAULT 0,
  created_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (template_id),
  KEY idx_tpl_public_created (is_public, created_at),
  KEY idx_tpl_creator (created_by),
  CONSTRAINT fk_tpl_creator FOREIGN KEY (created_by) REFERENCES Users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Workflows (
  workflow_id INT NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  category VARCHAR(100) NULL,
  skill_area VARCHAR(100) NULL,
  steps TEXT NOT NULL,
  is_public TINYINT(1) NOT NULL DEFAULT 1,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  is_ai_enabled TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (workflow_id),
  KEY idx_workflow_public (is_public, is_published, created_at),
  CONSTRAINT fk_workflow_creator FOREIGN KEY (created_by) REFERENCES Users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS GoalTemplateLinks (
  goal_id INT NOT NULL,
  template_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (goal_id, template_id),
  CONSTRAINT fk_goal_tpl_goal FOREIGN KEY (goal_id) REFERENCES Goals (goal_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_goal_tpl_template FOREIGN KEY (template_id) REFERENCES CommunityTemplates (template_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS GoalWorkflowLinks (
  goal_id INT NOT NULL,
  workflow_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (goal_id, workflow_id),
  CONSTRAINT fk_goal_workflow_goal FOREIGN KEY (goal_id) REFERENCES Goals (goal_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_goal_workflow_workflow FOREIGN KEY (workflow_id) REFERENCES Workflows (workflow_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ProjectWorkflowLinks (
  project_id INT NOT NULL,
  workflow_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, workflow_id),
  CONSTRAINT fk_project_workflow_project FOREIGN KEY (project_id) REFERENCES Projects (project_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_project_workflow_workflow FOREIGN KEY (workflow_id) REFERENCES Workflows (workflow_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
