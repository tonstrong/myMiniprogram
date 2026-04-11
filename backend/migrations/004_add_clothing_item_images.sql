ALTER TABLE clothing_items
  ADD COLUMN image_access_key VARCHAR(64) NULL AFTER image_original_url;

CREATE INDEX idx_clothing_items_user_image_key ON clothing_items(user_id, image_access_key);

CREATE TABLE clothing_item_images (
  item_id VARCHAR(64) PRIMARY KEY,
  content_type VARCHAR(64) NOT NULL,
  byte_size INT NOT NULL,
  bytes MEDIUMBLOB NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_clothing_item_images_item FOREIGN KEY (item_id) REFERENCES clothing_items(id) ON DELETE CASCADE
);
