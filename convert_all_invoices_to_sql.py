#!/usr/bin/env python3
"""
Merge + dedupe invoices from:
- Zoho Books invoice export (CSV, one row per line-item; invoice repeats)
- e-boekhouden invoice export (TSV-like, one row per invoice, with a preamble)

Goal: generate ONE SQL file that upserts invoices into public.customer_invoices
without creating duplicates when the same invoice exists in both exports.

Default inputs match the user's Downloads folder, but you can pass paths:
  python3 convert_all_invoices_to_sql.py /path/to/zoho.csv /path/to/eboekhouden.tsv
"""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


DEFAULT_ZOHO_CSV = "/Users/rogierschoenmakers/Downloads/Factuur (1).csv"
DEFAULT_EBOEKHOUDEN_EXPORT = "/Users/rogierschoenmakers/Downloads/Facturen GrowSocial 13-01-2026.csv"


CUSTOMER_ALIASES: Dict[str, str] = {
    # Explicit mappings you provided earlier
    "Best Bottles B.V.": "Jouwgeboortewijn",
    "Werken bij The Workspot": "The Workspot",
    "Klusbedrijf Sluijter": "Dakbeheer Acuut",
    "Tofiek": "Amsterdam Design",
    "Anroluca": "Dakmeester Nederland",
    "LIKE IT HARDER BOOKINGS": "Like It Harder",
    "Koos Kluytmans Interieurs B.V.": "Koos Kluytmans",
    "Steck 013": "Steck013",
    "Dakpreventie van der Steen B.V.": "Dakpreventie van der Steen",
    "Jd-dakexpert": "JD Dakexpert",
}

#
# If an invoice_number exists in both exports, Zoho is preferred by default.
# For rare cases where the exports conflict, you can force one source here:
#   "GS-0503": "eboekhouden"  # or "zoho_books"
#
INVOICE_SOURCE_OVERRIDES: Dict[str, str] = {
    # Example:
    # "GS-0503": "eboekhouden",
}


def _d2(x: Decimal) -> Decimal:
    return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def parse_decimal_maybe_eu(s: str) -> Decimal:
    """
    Parses either:
    - "1.185,80" (EU)
    - "1185.80" (US/Zoho)
    - "-907,50"
    - "" -> 0
    """
    if s is None:
        return Decimal("0")
    s = str(s).strip()
    if s == "":
        return Decimal("0")

    # If it contains comma as decimal separator: remove thousands '.' and swap ',' -> '.'
    if "," in s and re.search(r",\d{1,2}$", s):
        s = s.replace(".", "").replace(",", ".")
    try:
        return Decimal(s)
    except InvalidOperation:
        return Decimal("0")


def parse_date_iso(s: str) -> Optional[datetime]:
    s = (s or "").strip()
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d")
    except ValueError:
        return None


def parse_date_nl(s: str) -> Optional[datetime]:
    s = (s or "").strip()
    if not s:
        return None
    try:
        return datetime.strptime(s, "%d-%m-%Y")
    except ValueError:
        return None


def order_number_from_date(d: datetime) -> str:
    return f"ORD-{d.strftime('%Y%m%d')}"


def normalize_invoice_number(n: str) -> str:
    return (n or "").strip()


def normalize_customer_name(n: str) -> str:
    n = (n or "").strip()
    return CUSTOMER_ALIASES.get(n, n)


def sql_quote(s: str) -> str:
    return "'" + (s or "").replace("\\", "\\\\").replace("'", "''") + "'"


def jsonb_literal(obj: Any) -> str:
    # Make sure decimals are serialized nicely
    def _default(o: Any):
        if isinstance(o, Decimal):
            return float(_d2(o))
        raise TypeError(f"not json serializable: {type(o)}")

    return "$$" + json.dumps(obj, ensure_ascii=False, default=_default) + "$$::jsonb"


@dataclass
class CanonicalInvoice:
    invoice_number: str
    invoice_date: datetime
    due_date: Optional[datetime]
    customer_name: str
    amount_incl: Decimal
    outstanding_amount: Decimal
    status: str
    order_number: str
    notes: str
    line_items: List[Dict[str, Any]] = field(default_factory=list)
    external_id: Optional[str] = None
    external_system: str = "zoho_books"  # or eboekhouden


def parse_zoho(zoho_csv_path: str) -> Tuple[Dict[str, CanonicalInvoice], Dict[str, Any]]:
    by_invoice_id: Dict[str, Dict[str, Any]] = {}
    items_by_invoice_id: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    with open(zoho_csv_path, "r", encoding="utf-8-sig", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            inv_id = (row.get("Invoice ID") or "").strip()
            inv_no = normalize_invoice_number(row.get("Invoice Number") or "")
            if not inv_id or not inv_no:
                continue

            inv_date = parse_date_iso(row.get("Invoice Date") or "")
            if not inv_date:
                continue

            due_date = parse_date_iso(row.get("Due Date") or "")
            customer_name = normalize_customer_name(row.get("Customer Name") or "")

            total = _d2(parse_decimal_maybe_eu(row.get("Total") or "0"))
            balance = _d2(parse_decimal_maybe_eu(row.get("Balance") or "0"))
            inv_status = (row.get("Invoice Status") or "").strip().lower()

            # Map status + outstanding
            if total < 0:
                status = "cancelled"
                outstanding = Decimal("0")
            elif balance > 0:
                status = "pending"
                outstanding = balance
            else:
                # 'closed' in Zoho means fully paid
                status = "paid" if inv_status in ("closed", "paid") else "pending"
                outstanding = Decimal("0") if status == "paid" else balance

            # line item
            qty = parse_decimal_maybe_eu(row.get("Quantity") or "1")
            unit_price = _d2(parse_decimal_maybe_eu(row.get("Item Price") or "0"))
            item_subtotal = _d2(parse_decimal_maybe_eu(row.get("Item Total") or "0"))
            item_tax_amount = _d2(parse_decimal_maybe_eu(row.get("Item Tax Amount") or "0"))
            item_total = _d2(item_subtotal + item_tax_amount)

            item_name = (row.get("Item Name") or "").strip()
            item_desc = (row.get("Item Desc") or "").strip()
            description = (item_name or "").strip()
            if item_desc:
                description = (description + " — " + item_desc).strip(" —")
            description = description or "Dienstverlening"

            has_vat = item_tax_amount > 0

            items_by_invoice_id[inv_id].append(
                {
                    "description": description[:300],
                    "quantity": float(_d2(qty)),
                    "unit_price": float(unit_price),
                    "has_vat": bool(has_vat),
                    "subtotal": float(item_subtotal),
                    "vat_amount": float(item_tax_amount),
                    "total": float(item_total),
                }
            )

            # store invoice-level fields once (first row wins; totals/dates are repeated anyway)
            if inv_id not in by_invoice_id:
                by_invoice_id[inv_id] = {
                    "invoice_number": inv_no,
                    "invoice_date": inv_date,
                    "due_date": due_date,
                    "customer_name": customer_name,
                    "amount_incl": total,
                    "outstanding_amount": outstanding,
                    "status": status,
                    "external_id": inv_id,
                    "external_system": "zoho_books",
                    "notes": "Geïmporteerd uit Zoho Books",
                }

    invoices: Dict[str, CanonicalInvoice] = {}
    for inv_id, meta in by_invoice_id.items():
        inv_date = meta["invoice_date"]
        invoices[inv_id] = CanonicalInvoice(
            invoice_number=meta["invoice_number"],
            invoice_date=inv_date,
            due_date=meta["due_date"] or (inv_date + timedelta(days=14)),
            customer_name=meta["customer_name"],
            amount_incl=_d2(meta["amount_incl"]),
            outstanding_amount=_d2(meta["outstanding_amount"]),
            status=meta["status"],
            order_number=order_number_from_date(inv_date),
            notes=meta["notes"],
            line_items=items_by_invoice_id.get(inv_id, []),
            external_id=meta["external_id"],
            external_system=meta["external_system"],
        )

    report = {
        "zoho_invoice_count": len(invoices),
        "zoho_line_rows": sum(len(v) for v in items_by_invoice_id.values()),
    }
    return invoices, report


def parse_eboekhouden(export_path: str) -> Tuple[Dict[str, CanonicalInvoice], Dict[str, Any]]:
    # e-boekhouden export is a text file with a preamble; data starts at a header line.
    lines = Path(export_path).read_text(encoding="utf-8-sig").splitlines()
    header_idx = None
    for i, l in enumerate(lines):
        if l.strip().startswith("Datum") and "Nummer" in l and "Relatie" in l:
            header_idx = i
            break
    if header_idx is None:
        return {}, {"eboekhouden_invoice_count": 0, "error": "header_not_found"}

    header = lines[header_idx].split("\t")
    invoices: Dict[str, CanonicalInvoice] = {}

    for l in lines[header_idx + 1 :]:
        if not l.strip():
            continue
        parts = l.split("\t")
        if len(parts) < 5:
            continue

        row = dict(zip(header, parts))
        date_raw = row.get("Datum", "")
        inv_date = parse_date_nl(date_raw)
        if not inv_date:
            continue

        inv_no = normalize_invoice_number(row.get("Nummer", ""))
        if not inv_no:
            continue

        customer = normalize_customer_name(row.get("Relatie", ""))
        amount_excl = _d2(parse_decimal_maybe_eu(row.get("Bedrag (Excl)", "0")))
        amount_incl = _d2(parse_decimal_maybe_eu(row.get("Bedrag (Incl)", "0")))

        text = (row.get("Factuurtekst", "") or "").strip()
        notes = text if text else "Geïmporteerd uit e-boekhouden"

        if amount_incl < 0:
            status = "cancelled"
            outstanding = Decimal("0")
        else:
            # This export is historical; treat as paid unless you want otherwise
            status = "paid"
            outstanding = Decimal("0")

        vat_amount = _d2(abs(amount_incl - amount_excl)) if amount_incl >= 0 else Decimal("0")
        has_vat = vat_amount > 0

        line_item = {
            "description": (notes[:200] if text else "Dienstverlening"),
            "quantity": 1,
            "unit_price": float(abs(amount_excl)),
            "has_vat": bool(has_vat),
            "subtotal": float(abs(amount_excl)),
            "vat_amount": float(vat_amount),
            "total": float(abs(amount_incl)),
        }

        invoices[inv_no] = CanonicalInvoice(
            invoice_number=inv_no,
            invoice_date=inv_date,
            due_date=inv_date + timedelta(days=14),
            customer_name=customer,
            amount_incl=_d2(abs(amount_incl)),
            outstanding_amount=_d2(outstanding),
            status=status,
            order_number=order_number_from_date(inv_date),
            notes=notes,
            line_items=[line_item],
            external_id=inv_no,
            external_system="eboekhouden",
        )

    report = {"eboekhouden_invoice_count": len(invoices)}
    return invoices, report


def merge_dedupe(
    zoho_invoices_by_id: Dict[str, CanonicalInvoice],
    eboek_invoices_by_number: Dict[str, CanonicalInvoice],
) -> Tuple[List[CanonicalInvoice], Dict[str, Any]]:
    # Group Zoho by invoice_number (should be unique but keep safe)
    zoho_by_number: Dict[str, List[CanonicalInvoice]] = defaultdict(list)
    for inv in zoho_invoices_by_id.values():
        zoho_by_number[normalize_invoice_number(inv.invoice_number)].append(inv)

    conflicts_same_number_multiple_zoho = {k: len(v) for k, v in zoho_by_number.items() if len(v) > 1}

    # Choose Zoho for overlaps on invoice_number; otherwise take whichever exists.
    merged: Dict[Tuple[str, str], CanonicalInvoice] = {}  # (customer_name, invoice_number) -> invoice
    overlap_report: List[Dict[str, Any]] = []
    overlap_conflicts: List[Dict[str, Any]] = []
    renamed_due_to_customer_dupe: List[Dict[str, Any]] = []

    def _key(inv: CanonicalInvoice) -> Tuple[str, str]:
        return (inv.customer_name.lower().strip(), inv.invoice_number.strip())

    # First: take Zoho invoices (preferred)
    for inv_no, invs in zoho_by_number.items():
        chosen = invs[0]
        merged[_key(chosen)] = chosen

    # Then: add e-boekhouden invoices that aren't already present by invoice_number
    zoho_numbers = set(zoho_by_number.keys())
    for inv_no, einv in eboek_invoices_by_number.items():
        if inv_no in zoho_numbers:
            # record overlap info (and potential discrepancy)
            zinv = zoho_by_number[inv_no][0]
            ztot = _d2(zinv.amount_incl)
            etot = _d2(einv.amount_incl)
            override = INVOICE_SOURCE_OVERRIDES.get(inv_no)
            overlap_report.append(
                {
                    "invoice_number": inv_no,
                    "used": override or "zoho_books",
                    "zoho": {
                        "customer": zinv.customer_name,
                        "date": zinv.invoice_date.strftime("%Y-%m-%d"),
                        "total": float(ztot),
                    },
                    "eboekhouden": {
                        "customer": einv.customer_name,
                        "date": einv.invoice_date.strftime("%Y-%m-%d"),
                        "total": float(etot),
                    },
                }
            )
            if abs(ztot - etot) > Decimal("0.01"):
                overlap_conflicts.append(
                    {
                        "invoice_number": inv_no,
                        "zoho_total": float(ztot),
                        "eboekhouden_total": float(etot),
                        "override": override,
                    }
                )

            # Apply override (if any)
            if override == "eboekhouden":
                # Replace the Zoho version in the merged set with e-boekhouden (same customer+number).
                merged[_key(zinv)] = einv
            continue

        k = _key(einv)
        if k not in merged:
            merged[k] = einv
            continue

        # Same customer + same invoice_number already present (rare). Disambiguate by appending date.
        new_no = f"{einv.invoice_number}-{einv.invoice_date.strftime('%Y%m%d')}"
        renamed_due_to_customer_dupe.append(
            {
                "original_invoice_number": einv.invoice_number,
                "new_invoice_number": new_no,
                "customer": einv.customer_name,
                "reason": "duplicate (customer_name, invoice_number) in merged set",
                "source": einv.external_system,
            }
        )
        einv.invoice_number = new_no
        merged[_key(einv)] = einv

    merged_list = list(merged.values())
    merged_list.sort(key=lambda x: (x.invoice_date, x.invoice_number))

    report = {
        "merged_invoice_count": len(merged_list),
        "zoho_invoice_count": len(zoho_invoices_by_id),
        "eboekhouden_invoice_count": len(eboek_invoices_by_number),
        "overlap_invoice_numbers": len(overlap_report),
        "overlap_details": overlap_report[:200],  # cap in report file size
        "overlap_conflicts_count": len(overlap_conflicts),
        "overlap_conflicts": overlap_conflicts,
        "conflicts_multiple_zoho_same_number": conflicts_same_number_multiple_zoho,
        "renamed_due_to_customer_dupe": renamed_due_to_customer_dupe,
    }
    return merged_list, report


def generate_sql(invoices: List[CanonicalInvoice]) -> str:
    total_amount = _d2(sum((inv.amount_incl for inv in invoices), Decimal("0")))

    values_lines: List[str] = []
    for inv in invoices:
        due = inv.due_date.strftime("%Y-%m-%d") if inv.due_date else None
        values_lines.append(
            "("
            + ", ".join(
                [
                    sql_quote(inv.invoice_number),
                    sql_quote(inv.invoice_date.strftime("%Y-%m-%d")) + "::date",
                    (sql_quote(due) + "::date") if due else "NULL",
                    sql_quote(inv.customer_name),
                    str(float(_d2(inv.amount_incl))),
                    str(float(_d2(inv.outstanding_amount))),
                    sql_quote(inv.status),
                    sql_quote(inv.order_number),
                    sql_quote(inv.notes),
                    jsonb_literal(inv.line_items),
                    sql_quote(inv.external_id or inv.invoice_number),
                    sql_quote(inv.external_system),
                ]
            )
            + ")"
        )

    values_block = ",\n    ".join(values_lines)

    sql = f"""-- =====================================================
-- IMPORT ALL INVOICES (DEDUPED) FROM ZOHO + E-BOEKHOUDEN EXPORTS
-- - Zoho chosen when the same invoice_number exists in both sources
-- - Customer aliases applied (see convert_all_invoices_to_sql.py)
-- =====================================================
-- Total invoices: {len(invoices)}
-- Total amount (incl): €{total_amount}

BEGIN;

WITH invoice_data AS (
  SELECT * FROM (
    VALUES
    {values_block}
  ) AS t(
    invoice_number,
    invoice_date,
    due_date,
    customer_name,
    amount,
    outstanding_amount,
    status,
    order_number,
    notes,
    line_items,
    external_id,
    external_system
  )
),
customer_mapping AS (
  SELECT DISTINCT
    id.customer_name,
    c.id AS customer_id
  FROM invoice_data id
  LEFT JOIN public.customers c
    ON lower(c.company_name) = lower(id.customer_name)
    OR lower(c.name) = lower(id.customer_name)
),
new_customers AS (
  INSERT INTO public.customers (
    name,
    company_name,
    status,
    country,
    created_at,
    updated_at
  )
  SELECT DISTINCT
    cm.customer_name AS name,
    cm.customer_name AS company_name,
    'active' AS status,
    'NL' AS country,
    NOW() AS created_at,
    NOW() AS updated_at
  FROM customer_mapping cm
  WHERE cm.customer_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.customers c
      WHERE lower(c.company_name) = lower(cm.customer_name)
         OR lower(c.name) = lower(cm.customer_name)
    )
  RETURNING id, company_name
),
updated_customer_mapping AS (
  SELECT DISTINCT
    cm.customer_name,
    COALESCE(
      cm.customer_id,
      nc.id,
      (SELECT id FROM public.customers
       WHERE lower(company_name) = lower(cm.customer_name)
          OR lower(name) = lower(cm.customer_name)
       LIMIT 1)
    ) AS customer_id
  FROM customer_mapping cm
  LEFT JOIN new_customers nc
    ON lower(nc.company_name) = lower(cm.customer_name)
),
final_data AS (
  SELECT
    ucm.customer_id,
    id.invoice_number,
    id.invoice_date,
    id.due_date,
    id.order_number,
    id.amount,
    id.outstanding_amount,
    id.status,
    id.external_id,
    id.external_system,
    id.notes,
    id.line_items
  FROM invoice_data id
  LEFT JOIN updated_customer_mapping ucm ON id.customer_name = ucm.customer_name
  WHERE ucm.customer_id IS NOT NULL
),
updated AS (
  UPDATE public.customer_invoices ci
  SET
    invoice_date = fd.invoice_date,
    due_date = fd.due_date,
    order_number = fd.order_number,
    amount = fd.amount,
    outstanding_amount = fd.outstanding_amount,
    status = fd.status,
    external_id = fd.external_id,
    external_system = fd.external_system,
    notes = fd.notes,
    line_items = fd.line_items,
    updated_at = NOW()
  FROM final_data fd
  WHERE ci.customer_id = fd.customer_id
    AND ci.invoice_number = fd.invoice_number
  RETURNING ci.id, ci.customer_id, ci.invoice_number
)
INSERT INTO public.customer_invoices (
  customer_id,
  invoice_number,
  invoice_date,
  due_date,
  order_number,
  amount,
  outstanding_amount,
  status,
  external_id,
  external_system,
  notes,
  line_items,
  created_at,
  updated_at
)
SELECT
  fd.customer_id,
  fd.invoice_number,
  fd.invoice_date,
  fd.due_date,
  fd.order_number,
  fd.amount,
  fd.outstanding_amount,
  fd.status,
  fd.external_id,
  fd.external_system,
  fd.notes,
  fd.line_items,
  NOW(),
  NOW()
FROM final_data fd
WHERE NOT EXISTS (
  SELECT 1
  FROM updated u
  WHERE u.customer_id = fd.customer_id
    AND u.invoice_number = fd.invoice_number
);

COMMIT;

-- Imported/updated {len(invoices)} invoices
"""
    return sql


def main() -> int:
    zoho_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_ZOHO_CSV
    eboek_path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_EBOEKHOUDEN_EXPORT

    zoho_invoices, zoho_report = parse_zoho(zoho_path)
    eboek_invoices, eboek_report = parse_eboekhouden(eboek_path)

    merged, merge_report = merge_dedupe(zoho_invoices, eboek_invoices)

    sql = generate_sql(merged)

    out_sql = Path("import_all_invoices_deduped.sql")
    out_report = Path("import_all_invoices_deduped_report.json")
    out_sql.write_text(sql, encoding="utf-8")

    report = {
        "inputs": {"zoho": zoho_path, "eboekhouden": eboek_path},
        **zoho_report,
        **eboek_report,
        **merge_report,
    }
    out_report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    # Print short summary to stdout
    print(f"✅ Wrote {out_sql} ({len(merged)} invoices) and {out_report}")
    print(f"- Zoho invoices: {zoho_report.get('zoho_invoice_count')} (from {zoho_report.get('zoho_line_rows')} line-rows)")
    print(f"- e-boekhouden invoices: {eboek_report.get('eboekhouden_invoice_count')}")
    print(f"- Overlap invoice_numbers (Zoho preferred): {merge_report.get('overlap_invoice_numbers')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

