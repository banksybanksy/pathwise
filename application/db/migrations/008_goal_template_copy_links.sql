-- Pathwise M3: goal-template expansion tables for copy flow

CREATE TABLE IF NOT EXISTS GoalTemplateProjects (
  template_project_id INT NOT NULL AUTO_INCREMENT,
  template_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (template_project_id),
  KEY idx_gtp_template (template_id),
  CONSTRAINT fk_gtp_template FOREIGN KEY (template_id) REFERENCES CommunityTemplates (template_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS GoalTemplateMilestones (
  template_milestone_id INT NOT NULL AUTO_INCREMENT,
  template_project_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  target_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (template_milestone_id),
  KEY idx_gtm_project (template_project_id),
  CONSTRAINT fk_gtm_project FOREIGN KEY (template_project_id) REFERENCES GoalTemplateProjects (template_project_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS GoalTemplateResources (
  template_id INT NOT NULL,
  resource_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (template_id, resource_id),
  CONSTRAINT fk_gtr_template FOREIGN KEY (template_id) REFERENCES CommunityTemplates (template_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_gtr_resource FOREIGN KEY (resource_id) REFERENCES Resources (resource_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS GoalTemplateProjectResources (
  template_project_id INT NOT NULL,
  resource_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (template_project_id, resource_id),
  CONSTRAINT fk_gtpr_template_project FOREIGN KEY (template_project_id) REFERENCES GoalTemplateProjects (template_project_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_gtpr_resource FOREIGN KEY (resource_id) REFERENCES Resources (resource_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
