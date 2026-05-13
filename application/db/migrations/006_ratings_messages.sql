------------------------------------------------------------------------------------------

-- Why:
--   This is schema is needed for resource ratings and allow users to message
--   in-site without leaving the platform
--
-- What:
--   Technically, it creates the tables ResourceRatings and Messages with the 
--   necessary constraints and indexes.
--
-- Where used:
--   This is used to support resource recommendations to users on the platform
--   as well as messaging inbox/thread UI.
--
-- Notes:
--   - Run if the Users and Resources already exist
--   - This is safe for one-time migration on an existing Pathwise DB.
--   - The table it touches: 
--         ResourceRatings, 
--         Messages.
--
------------------------------------------------------------------------------------------

-- Pathwise: resource star ratings + in-app messaging

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
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_rr_stars CHECK (stars >= 1 AND stars <= 5)
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
