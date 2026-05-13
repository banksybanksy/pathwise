------------------------------------------------------------------------------------------

-- Why:
--   This sql adds the foundational table for user account verification as 
--   well as bookmark table that will serve for saved-resourceworkflows.
--
-- What:
--   It creates the User table, and Bookmarks join table as well as column additions
--   such as the submitted_by and costs fields to Resources.
--
-- Where used:
--   This the backbone for backend authentication routes, bookmark routes
--   and profile views
--
-- Notes:
--   - You run this after the base schema becuase resource needs to already have
--     existed to be altered properly
--   - This is safe for those who already have an existing DB with Resources 
--     already present.
--   - The table it touches: 
--        Users, 
--        Resources, 
--        Bookmarks, 
--

------------------------------------------------------------------------------------------

-- Pathwise M3: authentication, bookmarks, resource ownership & cost filter
-- Target database: pathwise (MySQL 8.0+)
--
-- Apply once from repo root or application/db/migrations:
--   mysql -h <RDS_HOST> -P 3306 -u <USER> -p pathwise < 001_m3_users_bookmarks.sql
--
-- Safe to run only once. If a column or table already exists, fix manually or skip that 
-- statement.

-- ---------------------------------------------------------------------------
-- 1. Users (register / login)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Users (
  user_id INT NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2. Resources: who submitted + optional cost (search filter / submit form)
-- ---------------------------------------------------------------------------
ALTER TABLE Resources
  ADD COLUMN submitted_by INT NULL DEFAULT NULL COMMENT 'FK to Users; NULL for seeded rows' AFTER category_id,
  ADD COLUMN cost VARCHAR(32) NULL DEFAULT NULL COMMENT 'e.g. free, paid' AFTER submitted_by;

ALTER TABLE Resources
  ADD CONSTRAINT fk_resources_submitted_by
  FOREIGN KEY (submitted_by) REFERENCES Users (user_id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. Bookmarks (saved resources per user)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Bookmarks (
  user_id INT NOT NULL,
  resource_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, resource_id),
  CONSTRAINT fk_bookmarks_user FOREIGN KEY (user_id) REFERENCES Users (user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_bookmarks_resource FOREIGN KEY (resource_id) REFERENCES Resources (resource_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
