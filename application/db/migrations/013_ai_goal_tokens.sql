-- Pathwise: add AI goal token balance to users
SET NAMES utf8mb4;
SET @db := DATABASE();

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'Users'
    AND COLUMN_NAME = 'ai_goal_tokens'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE Users ADD COLUMN ai_goal_tokens INT NOT NULL DEFAULT 5 AFTER role',
  'SELECT 1'
);
PREPARE stmt_add_col FROM @sql;
EXECUTE stmt_add_col;
DEALLOCATE PREPARE stmt_add_col;

-- Backfill existing users to the agreed starting amount.
UPDATE Users
SET ai_goal_tokens = 5
WHERE ai_goal_tokens IS NULL OR ai_goal_tokens < 0;
