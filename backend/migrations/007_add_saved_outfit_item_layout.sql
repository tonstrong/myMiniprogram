ALTER TABLE saved_outfit_items
  ADD COLUMN layout_x DECIMAL(8, 6) NULL AFTER sort_order,
  ADD COLUMN layout_y DECIMAL(8, 6) NULL AFTER layout_x,
  ADD COLUMN layout_w DECIMAL(8, 6) NULL AFTER layout_y,
  ADD COLUMN layout_h DECIMAL(8, 6) NULL AFTER layout_w,
  ADD COLUMN layer_index INTEGER NOT NULL DEFAULT 0 AFTER layout_h;
