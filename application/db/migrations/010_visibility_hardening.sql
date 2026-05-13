-- Pathwise M3: visibility/publish defaults on Resources
-- Oracle MySQL does not support "ADD COLUMN IF NOT EXISTS".
-- Add is_ai_enabled before visibility (visibility uses AFTER is_ai_enabled).

SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Resources' AND COLUMN_NAME = 'is_ai_enabled'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE Resources ADD COLUMN is_ai_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER cost',
  'SELECT 1'
);
PREPARE stmt_ai FROM @sql;
EXECUTE stmt_ai;
DEALLOCATE PREPARE stmt_ai;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Resources' AND COLUMN_NAME = 'visibility'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE Resources ADD COLUMN visibility ENUM(''public'', ''private'') NOT NULL DEFAULT ''public'' AFTER is_ai_enabled',
  'SELECT 1'
);
PREPARE stmt_vis FROM @sql;
EXECUTE stmt_vis;
DEALLOCATE PREPARE stmt_vis;

ALTER TABLE Resources
  MODIFY COLUMN visibility ENUM('public', 'private') NOT NULL DEFAULT 'public';
