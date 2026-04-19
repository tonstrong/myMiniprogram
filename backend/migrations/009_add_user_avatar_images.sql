CREATE TABLE user_avatar_images (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL UNIQUE,
  access_key VARCHAR(64) NOT NULL,
  content_type VARCHAR(64) NOT NULL,
  byte_size INT NOT NULL,
  image_data LONGBLOB NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_user_avatar_images_user FOREIGN KEY (user_id) REFERENCES users(id)
);
