#!/usr/bin/env python3
"""
Convert e-boekhouden CSV (semicolon separated) to SQL INSERT statements
"""

import csv
import sys
import json
from datetime import datetime, timedelta

def escape_sql_string(s):
    """Escape single quotes for SQL"""
    if s is None or s == '':
        return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"

def parse_date(date_str):
    """Parse DD-MM-YYYY date and generate due date and order number"""
    if not date_str:
        return None, None, None
    try:
        # DD-MM-YYYY format
        dt = datetime.strptime(date_str.strip(), '%d-%m-%Y')
        invoice_date = dt.strftime('%Y-%m-%d')
        due_date = (dt + timedelta(days=14)).strftime('%Y-%m-%d')
        order_num = f'ORD-{dt.strftime("%Y%m%d")}'
        return invoice_date, due_date, order_num
    except:
        return None, None, None

def parse_amount(amount_str):
    """Parse amount string (handles 1.185,80 format)"""
    if not amount_str:
        return 0.0
    try:
        # Remove thousand separators (dots) and replace comma with dot
        cleaned = str(amount_str).strip().replace('.', '').replace(',', '.')
        return float(cleaned)
    except:
        return 0.0

def main():
    csv_file = '/Users/rogierschoenmakers/Downloads/e-boekhouden_facturen_niet_in_zoho_SEMICOLON.csv'
    
    # Customer name mappings
    customer_mapping = {
        'Best Bottles B.V.': 'Jouwgeboortewijn',
        'Werken bij The Workspot': 'The Workspot',
        'Klusbedrijf Sluijter': 'Dakbeheer Acuut',
        'Tofiek': 'Amsterdam Design',
        'Steck 013': 'Steck013',
        'Dakpreventie van der Steen B.V.': 'Dakpreventie van der Steen'
    }
    
    invoices = []
    
    with open(csv_file, 'r', encoding='utf-8-sig') as f:  # utf-8-sig removes BOM
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            invoice_num = row.get('Nummer', '').strip()
            if not invoice_num:
                continue
            
            # Handle BOM in column name
            date_str = row.get('Datum', row.get('\ufeffDatum', '')).strip()
            customer = row.get('Relatie', '').strip()
            amount_excl_str = row.get('Bedrag (Excl)', '0').strip()
            amount_incl_str = row.get('Bedrag (Incl)', '0').strip()
            notes = row.get('Factuurtekst', '').strip() or 'Geïmporteerd uit e-boekhouden'
            
            # Parse amounts
            amount_excl = parse_amount(amount_excl_str)
            amount_incl = parse_amount(amount_incl_str)
            
            # Handle negative amounts (credit notes)
            if amount_incl < 0:
                status = 'cancelled'
                outstanding = 0
                has_vat = False
            else:
                status = 'paid'
                outstanding = 0
                has_vat = (amount_incl - amount_excl) > 0
            
            # Calculate VAT
            vat_amount = abs(amount_incl - amount_excl) if has_vat else 0
            
            # Parse dates
            inv_date, due_date, order_num = parse_date(date_str)
            if not inv_date:
                continue
            
            # Map customer name
            mapped_customer = customer_mapping.get(customer, customer)
            
            # Create line item
            line_item = {
                'description': notes[:200] if notes and notes != 'Geïmporteerd uit e-boekhouden' else 'Dienstverlening',
                'quantity': 1,
                'unit_price': abs(amount_excl),
                'has_vat': has_vat,
                'subtotal': abs(amount_excl),
                'vat_amount': vat_amount,
                'total': abs(amount_incl)
            }
            
            invoices.append({
                'invoice_number': invoice_num,
                'invoice_date': inv_date,
                'due_date': due_date,
                'customer': mapped_customer,
                'amount': abs(amount_incl),
                'outstanding': outstanding,
                'status': status,
                'order_number': order_num,
                'line_items': [line_item],
                'notes': notes[:500] if notes else 'Geïmporteerd uit e-boekhouden'
            })
    
    print("-- =====================================================")
    print("-- IMPORT MISSING INVOICES FROM E-BOEKHOUDEN")
    print("-- =====================================================")
    print(f"-- Total invoices: {len(invoices)}")
    print(f"-- Total amount: €{sum(i['amount'] for i in invoices):,.2f}")
    print()
    print("BEGIN;")
    print()
    print("WITH invoice_data AS (")
    print("  SELECT * FROM (")
    print("    VALUES")
    
    first = True
    for inv in invoices:
        line_items_json = json.dumps(inv['line_items'], ensure_ascii=False)
        line_items_sql = line_items_json.replace("'", "''")
        
        if not first:
            print(",")
        
        print(f"    (", end="")
        print(f"{escape_sql_string(inv['invoice_number'])}, ", end="")
        print(f"{escape_sql_string(inv['invoice_date'])}::date, ", end="")
        print(f"{escape_sql_string(inv['due_date'])}::date, ", end="")
        print(f"{escape_sql_string(inv['customer'])}, ", end="")
        print(f"{inv['amount']}, ", end="")
        print(f"{inv['outstanding']}, ", end="")
        print(f"{escape_sql_string(inv['status'])}, ", end="")
        print(f"{escape_sql_string(inv['order_number'])}, ", end="")
        print(f"{escape_sql_string(inv['notes'])}, ", end="")
        print(f"$${line_items_sql}$$::jsonb", end="")
        print(")", end="")
        
        first = False
    
    print()
    print("  ) AS t(")
    print("    invoice_number,")
    print("    invoice_date,")
    print("    due_date,")
    print("    customer_name,")
    print("    amount,")
    print("    outstanding_amount,")
    print("    status,")
    print("    order_number,")
    print("    notes,")
    print("    line_items")
    print("  )")
    print("),")
    print("customer_mapping AS (")
    print("  SELECT DISTINCT")
    print("    id.customer_name,")
    print("    c.id AS customer_id")
    print("  FROM invoice_data id")
    print("  LEFT JOIN public.customers c")
    print("    ON c.company_name ILIKE '%' || id.customer_name || '%'")
    print("    OR c.name ILIKE '%' || id.customer_name || '%'")
    print("),")
    print("-- Create missing customers")
    print("new_customers AS (")
    print("  INSERT INTO public.customers (")
    print("    name,")
    print("    company_name,")
    print("    status,")
    print("    country,")
    print("    created_at,")
    print("    updated_at")
    print("  )")
    print("  SELECT DISTINCT")
    print("    cm.customer_name AS name,")
    print("    cm.customer_name AS company_name,")
    print("    'active' AS status,")
    print("    'NL' AS country,")
    print("    NOW() AS created_at,")
    print("    NOW() AS updated_at")
    print("  FROM customer_mapping cm")
    print("  WHERE cm.customer_id IS NULL")
    print("    AND NOT EXISTS (")
    print("      SELECT 1 FROM public.customers c")
    print("      WHERE c.company_name ILIKE '%' || cm.customer_name || '%'")
    print("      OR c.name ILIKE '%' || cm.customer_name || '%'")
    print("    )")
    print("  RETURNING id, company_name")
    print("),")
    print("-- Update customer_mapping with newly created customers")
    print("updated_customer_mapping AS (")
    print("  SELECT DISTINCT")
    print("    cm.customer_name,")
    print("    COALESCE(")
    print("      cm.customer_id,")
    print("      nc.id,")
    print("      (SELECT id FROM public.customers")
    print("       WHERE company_name ILIKE '%' || cm.customer_name || '%'")
    print("       OR name ILIKE '%' || cm.customer_name || '%'")
    print("       LIMIT 1)")
    print("    ) AS customer_id")
    print("  FROM customer_mapping cm")
    print("  LEFT JOIN new_customers nc")
    print("    ON nc.company_name ILIKE '%' || cm.customer_name || '%'")
    print("),")
    print("final_data AS (")
    print("  SELECT")
    print("    ucm.customer_id,")
    print("    id.invoice_number,")
    print("    id.invoice_date,")
    print("    id.due_date,")
    print("    id.order_number,")
    print("    id.amount,")
    print("    id.outstanding_amount,")
    print("    id.status,")
    print("    id.notes,")
    print("    id.line_items,")
    print("    id.invoice_number AS external_id,")
    print("    'eboekhouden' AS external_system")
    print("  FROM invoice_data id")
    print("  LEFT JOIN updated_customer_mapping ucm ON id.customer_name = ucm.customer_name")
    print("  WHERE ucm.customer_id IS NOT NULL")
    print("),")
    print("updated AS (")
    print("  UPDATE public.customer_invoices ci")
    print("  SET")
    print("    invoice_date = fd.invoice_date,")
    print("    due_date = fd.due_date,")
    print("    order_number = fd.order_number,")
    print("    amount = fd.amount,")
    print("    outstanding_amount = fd.outstanding_amount,")
    print("    status = fd.status,")
    print("    external_id = fd.external_id,")
    print("    external_system = fd.external_system,")
    print("    notes = fd.notes,")
    print("    line_items = fd.line_items,")
    print("    updated_at = NOW()")
    print("  FROM final_data fd")
    print("  WHERE ci.customer_id = fd.customer_id")
    print("    AND ci.invoice_number = fd.invoice_number")
    print("  RETURNING ci.id, ci.customer_id, ci.invoice_number")
    print(")")
    print("INSERT INTO public.customer_invoices (")
    print("  customer_id,")
    print("  invoice_number,")
    print("  invoice_date,")
    print("  due_date,")
    print("  order_number,")
    print("  amount,")
    print("  outstanding_amount,")
    print("  status,")
    print("  external_id,")
    print("  external_system,")
    print("  notes,")
    print("  line_items,")
    print("  created_at,")
    print("  updated_at")
    print(")")
    print("SELECT")
    print("  fd.customer_id,")
    print("  fd.invoice_number,")
    print("  fd.invoice_date,")
    print("  fd.due_date,")
    print("  fd.order_number,")
    print("  fd.amount,")
    print("  fd.outstanding_amount,")
    print("  fd.status,")
    print("  fd.external_id,")
    print("  fd.external_system,")
    print("  fd.notes,")
    print("  fd.line_items,")
    print("  NOW(),")
    print("  NOW()")
    print("FROM final_data fd")
    print("WHERE NOT EXISTS (")
    print("  SELECT 1")
    print("  FROM updated u")
    print("  WHERE u.customer_id = fd.customer_id")
    print("    AND u.invoice_number = fd.invoice_number")
    print(");")
    print()
    print("COMMIT;")
    print()
    print(f"-- Imported {len(invoices)} invoices")

if __name__ == '__main__':
    main()
