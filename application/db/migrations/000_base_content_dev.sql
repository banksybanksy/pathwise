------------------------------------------------------------------------------------------

-- Why:
--   This sql is supposed to be the base content schema for those who
--   don't already have the full Pathwise SQL dump imported into their
--   system.
--
-- What:
--   Creates the Categories, Tags, Resources, and ResourceTags as well as
--   some small set of samples inserted into the Categories and tags tables.
--
-- Where used:
--   These tables will support materials/resources discovery, filtering, 
--   inserting and tagging.
--
-- Notes:
--   - You have to run this before before 001_m3_users_bookmarks.sql
--   - This is totally safe for: 
--         fresh dev databases only and not those who already have the base.
--   - Do not run if the full dump has already been imported.
--   - The table it touches: 
--        Categories, 
--        Tags, 
--        Resources, 
--        ResourceTags, 
--

------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Categories (
  category_id INT NOT NULL AUTO_INCREMENT,
  category_name VARCHAR(100) NOT NULL,
  PRIMARY KEY (category_id),
  UNIQUE KEY uq_categories_name (category_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Tags (
  tag_id INT NOT NULL AUTO_INCREMENT,
  tag_name VARCHAR(50) NOT NULL,
  PRIMARY KEY (tag_id),
  UNIQUE KEY uq_tags_name (tag_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Resources (
  resource_id INT NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  url VARCHAR(500) DEFAULT NULL,
  image_path VARCHAR(255) DEFAULT NULL,
  category_id INT NOT NULL,
  is_ai_enabled TINYINT(1) NOT NULL DEFAULT 0,
  visibility ENUM('public', 'private') NOT NULL DEFAULT 'public',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (resource_id),
  KEY idx_resources_category (category_id),
  CONSTRAINT fk_resources_category
    FOREIGN KEY (category_id) REFERENCES Categories (category_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ResourceTags (
  resource_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (resource_id, tag_id),
  KEY idx_resource_tags_tag (tag_id),
  CONSTRAINT fk_resource_tags_resource
    FOREIGN KEY (resource_id) REFERENCES Resources (resource_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_resource_tags_tag
    FOREIGN KEY (tag_id) REFERENCES Tags (tag_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO Categories (category_id, category_name) VALUES
  (1, 'Academic'),
  (2, 'Career'),
  (3, 'Personal'),
  (4, 'Wellness');

INSERT IGNORE INTO Tags (tag_name) VALUES
  ('resume'),
  ('internship'),
  ('study-skills');

-- How to use it - for a completely new developer machine:
---------
-- run 000_base_content_dev.sql
-- then run 001_m3_users_bookmarks.sql
-- then 002, 003, 004, 005, 006