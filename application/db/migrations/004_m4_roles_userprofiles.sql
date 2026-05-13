------------------------------------------------------------------------------------------

-- Why:
--   It adds role based feature that is needed for when faculty/staff restricted
--   elevated access are upheld and it also includes the profile personalization 
--   fields we need later to power our recommendation engine 
--
-- What:
--   Technically, it just addes a role column to Users (alter) and creates a 
--   new entirely table called UserProfiles that will store perferences for each 
--   user
--
-- Where used:
--   It will be used for authorization prievelges checks and personalizing 
--   resource/materials recommendations
--
-- Notes:
--   - Run this after 003
--   - This is safe to run for when on a DB Users already exists.
--   - The table it touches: 
--        Users, 
--        UserProfiles.
--
------------------------------------------------------------------------------------------

-- Pathwise: user roles + extended profile (run after 001–003)

ALTER TABLE Users
  ADD COLUMN role ENUM('student', 'faculty', 'staff') NOT NULL DEFAULT 'student'
  AFTER password_hash;

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
