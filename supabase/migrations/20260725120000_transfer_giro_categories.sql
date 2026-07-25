-- Leaf categories for transfers and ATM withdrawals (cartola auto-classify)
INSERT INTO categories (id, name, parent_id, entity, sort_order) VALUES
  ('consumo.transferencia', 'Transferencia enviada', 'consumo', 'personal', 6),
  ('consumo.giro', 'Giro cajero', 'consumo', 'personal', 7)
ON CONFLICT (id) DO NOTHING;
