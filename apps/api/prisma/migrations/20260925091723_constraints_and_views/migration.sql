-- Pencarian nama perusahaan
CREATE INDEX clients_company_name_trgm_idx
  ON clients USING gin (lower(company_name) gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- Integritas data uang & kuantitas
ALTER TABLE media_orders
  ADD CONSTRAINT mo_amounts_non_negative
    CHECK (subtotal >= 0 AND dpp_amount >= 0 AND ppn_amount >= 0 AND total_amount >= 0),
  ADD CONSTRAINT mo_period_valid
    CHECK (period_end >= period_start),
  ADD CONSTRAINT mo_number_required_after_submit
    CHECK (status = 'DRAFT' OR mo_number IS NOT NULL),
  ADD CONSTRAINT mo_cancel_reason_required
    CHECK (status <> 'CANCELLED' OR cancel_reason IS NOT NULL),
  ADD CONSTRAINT mo_cheque_no_required
    CHECK (payment_method <> 'CHEQUE_BG' OR status = 'DRAFT' OR cheque_no IS NOT NULL);

ALTER TABLE mo_benefits
  ADD CONSTRAINT mo_benefit_qty_valid
    CHECK (target_qty > 0 AND realized_qty >= 0 AND realized_qty <= target_qty AND bonus_qty >= 0);

ALTER TABLE billings
  ADD CONSTRAINT billing_amount_positive CHECK (amount > 0),
  ADD CONSTRAINT billing_paid_amount_valid CHECK (paid_amount IS NULL OR paid_amount > 0);

-- Satu penandatangan default per peran per organisasi
CREATE UNIQUE INDEX signatories_one_default_per_role
  ON signatories (organization_id, doc_role)
  WHERE is_default = true AND is_active = true;

-- Nomor invoice unik per organisasi (lewat MO)
CREATE UNIQUE INDEX billings_invoice_no_idx ON billings (media_order_id, invoice_no);

-- View Finance (lihat §6.4)

CREATE OR REPLACE VIEW v_mo_finance AS
SELECT
  m.id,
  m.organization_id,
  m.mo_number,
  m.mo_date,
  m.period_start,
  m.period_end,
  COALESCE(m.client_snapshot->>'companyName', c.company_name) AS company_name,
  s.name                 AS sales_name,
  m.subtotal             AS amount_before_tax,
  m.ppn_amount,
  m.total_amount         AS amount_after_tax,
  m.fulfillment_pct,
  m.status,
  m.billing_status,
  COALESCE(
    (SELECT jsonb_object_agg(bt.code,
              jsonb_build_object('target', b.target_qty, 'realized', b.realized_qty, 'bonus', b.bonus_qty))
       FROM mo_benefits b
       JOIN benefit_types bt ON bt.id = b.benefit_type_id
      WHERE b.media_order_id = m.id),
    '{}'::jsonb)         AS benefits,
  (SELECT COALESCE(SUM(amount), 0)      FROM billings WHERE media_order_id = m.id) AS billed_amount,
  (SELECT COALESCE(SUM(paid_amount), 0) FROM billings WHERE media_order_id = m.id) AS paid_amount
FROM media_orders m
JOIN clients c ON c.id = m.client_id
JOIN sales   s ON s.id = m.sales_id;
