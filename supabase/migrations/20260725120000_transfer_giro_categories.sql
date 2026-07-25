-- Leaf categories for transfers and ATM withdrawals (cartola auto-classify)
-- Ensure the parent exists first: on a fresh `db reset`, migrations run
-- before seed.sql, so 'consumo' isn't guaranteed to be there yet.
INSERT INTO categories (id, name, parent_id, entity, sort_order) VALUES
  ('consumo', 'Consumo', null, 'personal', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, parent_id, entity, sort_order) VALUES
  ('consumo.transferencia', 'Transferencia enviada', 'consumo', 'personal', 6),
  ('consumo.giro', 'Giro cajero', 'consumo', 'personal', 7)
ON CONFLICT (id) DO NOTHING;
