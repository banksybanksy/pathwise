-- Pathwise: admin user role + resource moderation (pending/approved/rejected)
SET NAMES utf8mb4;
SET @db := DATABASE();

-- Users: add 'admin' to role enum
ALTER TABLE Users
  MODIFY COLUMN role ENUM('student', 'faculty', 'staff', 'admin') NOT NULL DEFAULT 'student';

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Resources' AND COLUMN_NAME = 'moderation_status'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE Resources
     ADD COLUMN moderation_status ENUM(''pending'', ''approved'', ''rejected'') NOT NULL DEFAULT ''approved'' AFTER visibility,
     ADD KEY idx_resources_moderation (moderation_status)',
  'SELECT 1'
);
PREPARE stmt_mod FROM @sql;
EXECUTE stmt_mod;
DEALLOCATE PREPARE stmt_mod;
