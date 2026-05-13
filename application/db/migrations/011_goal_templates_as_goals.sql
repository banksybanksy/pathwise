-- Goal templates stored as Goals (draft → published) + star ratings

SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Goals' AND COLUMN_NAME = 'template_kind'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE Goals ADD COLUMN template_kind ENUM(''none'',''draft'',''published'') NOT NULL DEFAULT ''none'' AFTER status',
  'SELECT 1'
);
PREPARE s1 FROM @sql;
EXECUTE s1;
DEALLOCATE PREPARE s1;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Goals' AND COLUMN_NAME = 'template_copied_count'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE Goals ADD COLUMN template_copied_count INT NOT NULL DEFAULT 0 AFTER template_kind',
  'SELECT 1'
);
PREPARE s2 FROM @sql;
EXECUTE s2;
DEALLOCATE PREPARE s2;

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
