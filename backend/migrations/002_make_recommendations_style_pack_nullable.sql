ALTER TABLE recommendations DROP FOREIGN KEY fk_recommendations_style_pack;

ALTER TABLE recommendations
  MODIFY style_pack_id VARCHAR(64) NULL;

ALTER TABLE recommendations
  ADD CONSTRAINT fk_recommendations_style_pack
    FOREIGN KEY (style_pack_id) REFERENCES style_packs(id);
