#!/usr/bin/env python3
"""
Convert Zoho Books CSV export to SQL INSERT statements for Supabase
Usage: python convert_csv_to_sql.py "Factuur (1).csv" > import_invoices.sql
"""

import csv
import sys
import json
from collections import defaultdict
from datetime import datetime, timedelta

def parse_date(date_str):
    """Parse date string to YYYY-MM-DD format"""
    if not date_str:
        return None
    try:
        # Try YYYY-MM-DD format first
        dt = datetime.strptime(date_str.strip(), '%Y-%m-%d')
        return dt.strftime('%Y-%m-%d')
    except:
        try:
            # Try DD-MM-YYYY format
            dt = datetime.strptime(date_str.strip(), '%d-%m-%Y')
            return dt.strftime('%Y-%m-%d')
        except:
            return None

def parse_amount(amount_str):
    """Parse amount string to float"""
    if not amount_str:
        return 0.0
    try:
        return float(str(amount_str).replace(',', '.').strip())
    except:
        return 0.0

def escape_sql_string(s):
    """Escape single quotes for SQL"""
    if s is None:
        return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"

def main():
    if len(sys.argv) < 2:
        print("Usage: python convert_csv_to_sql.py <csv_file>", file=sys.stderr)
        sys.exit(1)
    
    csv_file = sys.argv[1]
    
    # Group invoices by invoice_number and invoice_date
    invoices = defaultdict(lambda: {
        'invoice_date': None,
        'due_date': None,
        'customer_name': None,
        'subtotal': 0.0,
        'total': 0.0,
        'balance': 0.0,
        'invoice_status': None,
        'notes': None,
        'line_items': []
    })
    
    print("-- =====================================================")
    print("-- IMPORT INVOICES FROM ZOHO BOOKS CSV")
    print("-- =====================================================")
    print("-- Generated from:", csv_file)
    print("-- Generated at:", datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
    print()
    print("BEGIN;")
    print()
    print("WITH invoice_data AS (")
    print("  SELECT * FROM (")
    print("    VALUES")
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            invoice_values = []
            
            for row in reader:
                invoice_num = row.get('Invoice Number', '').strip()
                invoice_date = parse_date(row.get('Invoice Date', ''))
                customer_name = row.get('Customer Name', '').strip()
                
                if not invoice_num or not invoice_date:
                    continue
                
                key = (invoice_num, invoice_date)
                
                # Update invoice summary
                if key not in invoices or not invoices[key]['customer_name']:
                    invoices[key]['invoice_date'] = invoice_date
                    invoices[key]['due_date'] = parse_date(row.get('Due Date', ''))
                    invoices[key]['customer_name'] = customer_name
                    invoices[key]['subtotal'] = parse_amount(row.get('SubTotal', '0'))
                    invoices[key]['total'] = parse_amount(row.get('Total', '0'))
                    invoices[key]['balance'] = parse_amount(row.get('Balance', '0'))
                    invoices[key]['invoice_status'] = row.get('Invoice Status', '').strip()
                    invoices[key]['notes'] = row.get('Notes', '').strip() or 'Geïmporteerd uit Zoho Books'
                
                # Add line item
                item_name = row.get('Item Name', '').strip()
                item_desc = row.get('Item Desc', '').strip()
                quantity = parse_amount(row.get('Quantity', '1'))
                item_total = parse_amount(row.get('Item Total', '0'))
                item_price = parse_amount(row.get('Item Price', '0'))
                item_tax_percent = parse_amount(row.get('Item Tax %', '0'))
                item_tax_amount = parse_amount(row.get('Item Tax Amount', '0'))
                
                if item_name or item_desc:
                    description = item_desc or item_name or 'Dienstverlening'
                    unit_price = item_price if item_price > 0 else (item_total / quantity if quantity > 0 else 0)
                    has_vat = item_tax_percent > 0
                    vat_amount = item_tax_amount if item_tax_amount > 0 else (item_total * 0.21 if has_vat else 0)
                    total = item_total + vat_amount
                    
                    invoices[key]['line_items'].append({
                        'description': description,
                        'quantity': quantity,
                        'unit_price': unit_price,
                        'has_vat': has_vat,
                        'subtotal': item_total,
                        'vat_amount': vat_amount,
                        'total': total
                    })
            
            # Generate SQL VALUES
            first = True
            for (invoice_num, invoice_date), inv_data in invoices.items():
                if not inv_data['customer_name']:
                    continue
                
                # Determine status
                if inv_data['invoice_status'] == 'Closed' or inv_data['balance'] == 0:
                    status = 'paid'
                    outstanding = 0.0
                else:
                    status = 'pending'
                    outstanding = inv_data['balance'] if inv_data['balance'] > 0 else inv_data['total']
                
                # Generate order number
                try:
                    dt = datetime.strptime(invoice_date, '%Y-%m-%d')
                    order_num = f"ORD-{dt.strftime('%Y%m%d')}"
                except:
                    order_num = f"ORD-{invoice_num}"
                
                # Generate line items JSON
                line_items_json = json.dumps(inv_data['line_items'], ensure_ascii=False)
                line_items_sql = line_items_json.replace("'", "''")
                
                # Calculate due date
                due_date = inv_data['due_date']
                if not due_date:
                    try:
                        dt = datetime.strptime(invoice_date, '%Y-%m-%d')
                        due_date = (dt + timedelta(days=14)).strftime('%Y-%m-%d')
                    except:
                        due_date = invoice_date
                
                if not first:
                    print(",")
                
                print(f"    (", end="")
                print(f"{escape_sql_string(invoice_num)}, ", end="")
                print(f"{escape_sql_string(invoice_date)}::date, ", end="")
                print(f"{escape_sql_string(due_date)}::date, ", end="")
                print(f"{escape_sql_string(inv_data['customer_name'])}, ", end="")
                print(f"{inv_data['total']}, ", end="")
                print(f"{outstanding}, ", end="")
                print(f"{escape_sql_string(status)}, ", end="")
                print(f"{escape_sql_string(inv_data['notes'])}, ", end="")
                print(f"{escape_sql_string(order_num)}, ", end="")
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
            print("    notes,")
            print("    order_number,")
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
            print("    'zoho_books' AS external_system")
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
            
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
