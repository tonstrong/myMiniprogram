CREATE TABLE saved_outfits (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  source_type VARCHAR(32) NOT NULL,
  cover_item_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_saved_outfits_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_saved_outfits_cover_item FOREIGN KEY (cover_item_id) REFERENCES clothing_items(id)
);

CREATE INDEX idx_saved_outfits_user_created ON saved_outfits(user_id, created_at);

CREATE TABLE saved_outfit_items (
  id VARCHAR(64) PRIMARY KEY,
  saved_outfit_id VARCHAR(64) NOT NULL,
  item_id VARCHAR(64) NOT NULL,
  slot_code VARCHAR(32) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_saved_outfit_items_outfit FOREIGN KEY (saved_outfit_id) REFERENCES saved_outfits(id) ON DELETE CASCADE,
  CONSTRAINT fk_saved_outfit_items_item FOREIGN KEY (item_id) REFERENCES clothing_items(id)
);

CREATE INDEX idx_saved_outfit_items_slot_order ON saved_outfit_items(saved_outfit_id, slot_code, sort_order);
