-- Pathwise master migration
-- Purpose: bootstrap a brand-new database with all required schema in one pass.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS Users (
  user_id INT NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student', 'faculty', 'staff', 'admin') NOT NULL DEFAULT 'student',
  ai_goal_tokens INT NOT NULL DEFAULT 5,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Categories (
  category_id INT NOT NULL AUTO_INCREMENT,
  category_name VARCHAR(100) NOT NULL,
  PRIMARY KEY (category_id),
  UNIQUE KEY uq_categories_name (category_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Tags (
  tag_id INT NOT NULL AUTO_INCREMENT,
  tag_name VARCHAR(100) NOT NULL,
  PRIMARY KEY (tag_id),
  UNIQUE KEY uq_tags_name (tag_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Resources (
  resource_id INT NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  url VARCHAR(2048) NULL,
  image_path VARCHAR(512) NULL,
  category_id INT NULL,
  skill_area VARCHAR(100) NULL,
  submitted_by INT NULL,
  cost VARCHAR(32) NULL,
  is_ai_enabled TINYINT(1) NOT NULL DEFAULT 0,
  visibility ENUM('public', 'private') NOT NULL DEFAULT 'public',
  moderation_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (resource_id),
  KEY idx_resources_category (category_id),
  KEY idx_resources_submitter (submitted_by),
  KEY idx_resources_moderation (moderation_status),
  CONSTRAINT fk_resources_category FOREIGN KEY (category_id) REFERENCES Categories (category_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_resources_submitter FOREIGN KEY (submitted_by) REFERENCES Users (user_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ResourceTags (
  resource_id INT NOT NULL,
  tag_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (resource_id, tag_id),
  CONSTRAINT fk_resource_tags_resource FOREIGN KEY (resource_id) REFERENCES Resources (resource_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_resource_tags_tag FOREIGN KEY (tag_id) REFERENCES Tags (tag_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Bookmarks (
  user_id INT NOT NULL,
  resource_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, resource_id),
  CONSTRAINT fk_bookmarks_user FOREIGN KEY (user_id) REFERENCES Users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_bookmarks_resource FOREIGN KEY (resource_id) REFERENCES Resources (resource_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Goals (
  goal_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  category VARCHAR(100) NULL,
  target_date DATE NULL,
  status ENUM('active', 'paused', 'completed') NOT NULL DEFAULT 'active',
  template_kind ENUM('none', 'draft', 'published') NOT NULL DEFAULT 'none',
  template_copied_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (goal_id),
  KEY idx_goals_user (user_id),
  KEY idx_goals_template (template_kind),
  CONSTRAINT fk_goals_user FOREIGN KEY (user_id) REFERENCES Users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS GoalTemplateRatings (
  user_id INT NOT NULL,
  template_goal_id INT NOT NULL,
  stars TINYINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, template_goal_id),
  CONSTRAINT fk_gtr_user FOREIGN KEY (user_id) REFERENCES Users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_gtr_goal FOREIGN KEY (template_goal_id) REFERENCES Goals (goal_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_gtr_stars CHECK (stars >= 1 AND stars <= 5)
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
    ON DELETE CASCADE ON UPDATE CASCADE
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
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS GoalResources (
  goal_id INT NOT NULL,
  resource_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (goal_id, resource_id),
  CONSTRAINT fk_goal_resources_goal FOREIGN KEY (goal_id) REFERENCES Goals (goal_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_goal_resources_resource FOREIGN KEY (resource_id) REFERENCES Resources (resource_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ProjectResources (
  project_id INT NOT NULL,
  resource_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, resource_id),
  CONSTRAINT fk_project_resources_project FOREIGN KEY (project_id) REFERENCES Projects (project_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_project_resources_resource FOREIGN KEY (resource_id) REFERENCES Resources (resource_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS UserProfiles (
  user_id INT NOT NULL,
  interests TEXT NULL,
  challenges TEXT NULL,
  workload VARCHAR(100) NULL,
  aspirations TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES Users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS ResourceRatings (
  user_id INT NOT NULL,
  resource_id INT NOT NULL,
  stars TINYINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, resource_id),
  CONSTRAINT fk_rr_user FOREIGN KEY (user_id) REFERENCES Users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_rr_resource FOREIGN KEY (resource_id) REFERENCES Resources (resource_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Messages (
  message_id INT NOT NULL AUTO_INCREMENT,
  from_user_id INT NOT NULL,
  to_user_id INT NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id),
  KEY idx_msg_to_created (to_user_id, created_at),
  KEY idx_msg_pair (from_user_id, to_user_id, created_at),
  CONSTRAINT fk_msg_from FOREIGN KEY (from_user_id) REFERENCES Users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_msg_to FOREIGN KEY (to_user_id) REFERENCES Users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS GoalTemplateProjects (
  template_project_id INT NOT NULL AUTO_INCREMENT,
  template_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (template_project_id),
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

CREATE TABLE IF NOT EXISTS Shares (
  share_id INT NOT NULL AUTO_INCREMENT,
  sender_user_id INT NOT NULL,
  recipient_user_id INT NOT NULL,
  item_type ENUM('resource', 'template', 'workflow', 'goal_template') NOT NULL,
  item_id INT NOT NULL,
  message VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (share_id),
  KEY idx_shares_recipient_created (recipient_user_id, created_at),
  KEY idx_shares_sender_created (sender_user_id, created_at),
  CONSTRAINT fk_shares_sender FOREIGN KEY (sender_user_id) REFERENCES Users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_shares_recipient FOREIGN KEY (recipient_user_id) REFERENCES Users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS PasswordResetTokens (
  token_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_id),
  KEY idx_prt_user (user_id),
  KEY idx_prt_hash (token_hash),
  CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES Users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
