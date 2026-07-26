-- Leaf category for bank loan installments (Banco Chile PAGO DE CREDITOS).
INSERT INTO categories (id, name, parent_id, entity, sort_order) VALUES
  ('deuda', 'Deuda', null, 'personal', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, parent_id, entity, sort_order) VALUES
  ('deuda.cuota', 'Cuota préstamo', 'deuda', 'personal', 1)
ON CONFLICT (id) DO NOTHING;
