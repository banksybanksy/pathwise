-- Pathwise M3: sharing support

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
  KEY idx_shares_item (item_type, item_id),
  KEY idx_shares_dedupe (sender_user_id, recipient_user_id, item_type, item_id, created_at),
  CONSTRAINT fk_shares_sender FOREIGN KEY (sender_user_id) REFERENCES Users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_shares_recipient FOREIGN KEY (recipient_user_id) REFERENCES Users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
