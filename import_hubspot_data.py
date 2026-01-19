#!/usr/bin/env python3
"""
Script om HubSpot CSV export te importeren in de profiles tabel.
Genereert een SQL script dat kan worden uitgevoerd in Supabase.
"""

import csv
import re
from urllib.parse import urlparse

def normalize_domain(url):
    """Normaliseer een URL naar een domeinnaam."""
    if not url or url.strip() == '':
        return None
    
    # Verwijder whitespace
    url = url.strip()
    
    # Als het al een domein is (geen http://), voeg het toe
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    try:
        parsed = urlparse(url)
        domain = parsed.netloc or parsed.path
        # Verwijder www. prefix
        domain = re.sub(r'^www\.', '', domain)
        # Verwijder trailing slash
        domain = domain.rstrip('/')
        return domain.lower() if domain else None
    except:
        return None

def normalize_phone(phone):
    """Normaliseer telefoonnummer."""
    if not phone or phone.strip() == '':
        return None
    
    # Verwijder whitespace en speciale tekens behalve + en cijfers
    phone = re.sub(r'[^\d+]', '', phone.strip())
    return phone if phone else None

def escape_sql_string(value):
    """Escape SQL string waarden."""
    if value is None or value == '':
        return 'NULL'
    # Escape single quotes
    value = str(value).replace("'", "''")
    return f"'{value}'"

def generate_sql(csv_file_path, output_sql_path):
    """Genereer SQL import script."""
    
    # Mapping van CSV kolommen naar database velden
    # Kolom indices (0-based)
    COLUMNS = {
        'company_name': 'Naam onderneming',
        'website_url': 'Website-URL',
        'domain_name': 'Domeinnaam onderneming',
        'phone': 'Telefoonnummer',
        'city': 'Plaats',
        'postal_code': 'Postcode',
        'province': 'Provincie/regio',
        'country': 'Land/regio',
        'description': 'Beschrijving',
        'industry': 'Branche',
        'address': 'Adres',
        'address2': 'Adres 2',
    }
    
    # Lees CSV en vind kolom indices
    with open(csv_file_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        
        # Vind kolom indices
        col_indices = {}
        for db_field, csv_col_name in COLUMNS.items():
            try:
                col_indices[db_field] = header.index(csv_col_name)
            except ValueError:
                col_indices[db_field] = None
                print(f"⚠️  Kolom '{csv_col_name}' niet gevonden in CSV")
    
    # Genereer SQL
    sql_lines = [
        "-- HubSpot Data Import Script",
        "-- Genereerd automatisch vanuit CSV export",
        "",
        "-- Stap 1: Maak temporary table aan",
        "CREATE TEMP TABLE IF NOT EXISTS hubspot_import (",
        "    company_name TEXT,",
        "    domain TEXT,",
        "    phone TEXT,",
        "    city TEXT,",
        "    postal_code TEXT,",
        "    province TEXT,",
        "    country TEXT,",
        "    description TEXT,",
        "    industry TEXT,",
        "    address TEXT,",
        "    address2 TEXT",
        ");",
        "",
        "-- Stap 2: Insert data in temporary table",
    ]
    
    # Lees CSV data
    row_count = 0
    with open(csv_file_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # Skip header
        
        for row in reader:
            if len(row) < max([i for i in col_indices.values() if i is not None] or [0]) + 1:
                continue
            
            # Haal waarden op
            company_name = row[col_indices['company_name']].strip() if col_indices['company_name'] and len(row) > col_indices['company_name'] else ''
            website_url = row[col_indices['website_url']].strip() if col_indices['website_url'] and len(row) > col_indices['website_url'] else ''
            domain_name = row[col_indices['domain_name']].strip() if col_indices['domain_name'] and len(row) > col_indices['domain_name'] else ''
            phone = row[col_indices['phone']].strip() if col_indices['phone'] and len(row) > col_indices['phone'] else ''
            city = row[col_indices['city']].strip() if col_indices['city'] and len(row) > col_indices['city'] else ''
            postal_code = row[col_indices['postal_code']].strip() if col_indices['postal_code'] and len(row) > col_indices['postal_code'] else ''
            province = row[col_indices['province']].strip() if col_indices['province'] and len(row) > col_indices['province'] else ''
            country = row[col_indices['country']].strip() if col_indices['country'] and len(row) > col_indices['country'] else ''
            description = row[col_indices['description']].strip() if col_indices['description'] and len(row) > col_indices['description'] else ''
            industry = row[col_indices['industry']].strip() if col_indices['industry'] and len(row) > col_indices['industry'] else ''
            address = row[col_indices['address']].strip() if col_indices['address'] and len(row) > col_indices['address'] else ''
            address2 = row[col_indices['address2']].strip() if col_indices['address2'] and len(row) > col_indices['address2'] else ''
            
            # Skip lege rijen
            if not company_name and not website_url and not domain_name:
                continue
            
            # Normaliseer domain
            domain = normalize_domain(website_url) or normalize_domain(domain_name)
            
            # Normaliseer phone
            phone_normalized = normalize_phone(phone)
            
            # Combineer address velden
            full_address = address
            if address2:
                full_address = f"{address}, {address2}" if address else address2
            
            # Genereer INSERT statement
            sql_lines.append(
                f"INSERT INTO hubspot_import VALUES ("
                f"{escape_sql_string(company_name)}, "
                f"{escape_sql_string(domain)}, "
                f"{escape_sql_string(phone_normalized)}, "
                f"{escape_sql_string(city)}, "
                f"{escape_sql_string(postal_code)}, "
                f"{escape_sql_string(province)}, "
                f"{escape_sql_string(country)}, "
                f"{escape_sql_string(description)}, "
                f"{escape_sql_string(industry)}, "
                f"{escape_sql_string(full_address)}, "
                f"{escape_sql_string(address2)}"
                f");"
            )
            row_count += 1
    
    sql_lines.extend([
        "",
        f"-- Totaal {row_count} rijen geïmporteerd",
        "",
        "-- Stap 3: Update bestaande customers op basis van company_name (exacte match)",
        "-- Update zowel normale velden als HubSpot velden",
        "UPDATE customers c",
        "SET",
        "    phone = COALESCE(NULLIF(h.phone, ''), c.phone),",
        "    city = COALESCE(NULLIF(h.city, ''), c.city),",
        "    postal_code = COALESCE(NULLIF(h.postal_code, ''), c.postal_code),",
        "    country = COALESCE(NULLIF(h.country, ''), c.country),",
        "    address = COALESCE(NULLIF(h.address, ''), c.address),",
        "    domain = COALESCE(NULLIF(h.domain, ''), c.domain),",
        "    hubspot_company_name = COALESCE(NULLIF(h.company_name, ''), c.hubspot_company_name),",
        "    hubspot_primary_domain = COALESCE(NULLIF(h.domain, ''), c.hubspot_primary_domain),",
        "    hubspot_website_url = COALESCE(NULLIF(h.domain, ''), c.hubspot_website_url),",
        "    hubspot_phone = COALESCE(NULLIF(h.phone, ''), c.hubspot_phone),",
        "    hubspot_city = COALESCE(NULLIF(h.city, ''), c.hubspot_city),",
        "    hubspot_postcode = COALESCE(NULLIF(h.postal_code, ''), c.hubspot_postcode),",
        "    hubspot_country = COALESCE(NULLIF(h.country, ''), c.hubspot_country),",
        "    hubspot_address1 = COALESCE(NULLIF(h.address, ''), c.hubspot_address1),",
        "    hubspot_industry = COALESCE(NULLIF(h.industry, ''), c.hubspot_industry),",
        "    updated_at = NOW()",
        "FROM hubspot_import h",
        "WHERE h.company_name IS NOT NULL",
        "    AND h.company_name != ''",
        "    AND LOWER(TRIM(c.company_name)) = LOWER(TRIM(h.company_name));",
        "",
        "-- Stap 4: Update bestaande customers op basis van domain (als company_name niet matcht)",
        "UPDATE customers c",
        "SET",
        "    company_name = COALESCE(NULLIF(h.company_name, ''), c.company_name),",
        "    phone = COALESCE(NULLIF(h.phone, ''), c.phone),",
        "    city = COALESCE(NULLIF(h.city, ''), c.city),",
        "    postal_code = COALESCE(NULLIF(h.postal_code, ''), c.postal_code),",
        "    country = COALESCE(NULLIF(h.country, ''), c.country),",
        "    address = COALESCE(NULLIF(h.address, ''), c.address),",
        "    domain = COALESCE(NULLIF(h.domain, ''), c.domain),",
        "    hubspot_company_name = COALESCE(NULLIF(h.company_name, ''), c.hubspot_company_name),",
        "    hubspot_primary_domain = COALESCE(NULLIF(h.domain, ''), c.hubspot_primary_domain),",
        "    hubspot_website_url = COALESCE(NULLIF(h.domain, ''), c.hubspot_website_url),",
        "    hubspot_phone = COALESCE(NULLIF(h.phone, ''), c.hubspot_phone),",
        "    hubspot_city = COALESCE(NULLIF(h.city, ''), c.hubspot_city),",
        "    hubspot_postcode = COALESCE(NULLIF(h.postal_code, ''), c.hubspot_postcode),",
        "    hubspot_country = COALESCE(NULLIF(h.country, ''), c.hubspot_country),",
        "    hubspot_address1 = COALESCE(NULLIF(h.address, ''), c.hubspot_address1),",
        "    hubspot_industry = COALESCE(NULLIF(h.industry, ''), c.hubspot_industry),",
        "    updated_at = NOW()",
        "FROM hubspot_import h",
        "WHERE h.domain IS NOT NULL",
        "    AND h.domain != ''",
        "    AND (",
        "        LOWER(TRIM(REGEXP_REPLACE(c.domain, '^https?://', ''))) = LOWER(TRIM(h.domain))",
        "        OR LOWER(TRIM(REGEXP_REPLACE(c.domain, '^www\\.', ''))) = LOWER(TRIM(h.domain))",
        "        OR LOWER(TRIM(REGEXP_REPLACE(c.hubspot_primary_domain, '^https?://', ''))) = LOWER(TRIM(h.domain))",
        "        OR LOWER(TRIM(REGEXP_REPLACE(c.hubspot_website_url, '^https?://', ''))) = LOWER(TRIM(h.domain))",
        "    )",
        "    AND LOWER(TRIM(c.company_name)) != LOWER(TRIM(h.company_name)); -- Alleen als company_name niet matcht",
        "",
        "-- Stap 5: Update bestaande customers op basis van company_name (fuzzy match - bevat)",
        "-- Dit vult lege velden aan voor customers die gedeeltelijk matchen",
        "UPDATE customers c",
        "SET",
        "    phone = CASE WHEN c.phone IS NULL OR c.phone = '' THEN h.phone ELSE c.phone END,",
        "    city = CASE WHEN c.city IS NULL OR c.city = '' THEN h.city ELSE c.city END,",
        "    postal_code = CASE WHEN c.postal_code IS NULL OR c.postal_code = '' THEN h.postal_code ELSE c.postal_code END,",
        "    country = CASE WHEN c.country IS NULL OR c.country = '' THEN h.country ELSE c.country END,",
        "    address = CASE WHEN c.address IS NULL OR c.address = '' THEN h.address ELSE c.address END,",
        "    domain = CASE WHEN c.domain IS NULL OR c.domain = '' THEN h.domain ELSE c.domain END,",
        "    hubspot_company_name = CASE WHEN c.hubspot_company_name IS NULL OR c.hubspot_company_name = '' THEN h.company_name ELSE c.hubspot_company_name END,",
        "    hubspot_primary_domain = CASE WHEN c.hubspot_primary_domain IS NULL OR c.hubspot_primary_domain = '' THEN h.domain ELSE c.hubspot_primary_domain END,",
        "    hubspot_website_url = CASE WHEN c.hubspot_website_url IS NULL OR c.hubspot_website_url = '' THEN h.domain ELSE c.hubspot_website_url END,",
        "    hubspot_phone = CASE WHEN c.hubspot_phone IS NULL OR c.hubspot_phone = '' THEN h.phone ELSE c.hubspot_phone END,",
        "    hubspot_city = CASE WHEN c.hubspot_city IS NULL OR c.hubspot_city = '' THEN h.city ELSE c.hubspot_city END,",
        "    hubspot_postcode = CASE WHEN c.hubspot_postcode IS NULL OR c.hubspot_postcode = '' THEN h.postal_code ELSE c.hubspot_postcode END,",
        "    hubspot_country = CASE WHEN c.hubspot_country IS NULL OR c.hubspot_country = '' THEN h.country ELSE c.hubspot_country END,",
        "    hubspot_address1 = CASE WHEN c.hubspot_address1 IS NULL OR c.hubspot_address1 = '' THEN h.address ELSE c.hubspot_address1 END,",
        "    hubspot_industry = CASE WHEN c.hubspot_industry IS NULL OR c.hubspot_industry = '' THEN h.industry ELSE c.hubspot_industry END,",
        "    updated_at = NOW()",
        "FROM hubspot_import h",
        "WHERE h.company_name IS NOT NULL",
        "    AND h.company_name != ''",
        "    AND (",
        "        LOWER(TRIM(c.company_name)) LIKE '%' || LOWER(TRIM(h.company_name)) || '%'",
        "        OR LOWER(TRIM(h.company_name)) LIKE '%' || LOWER(TRIM(c.company_name)) || '%'",
        "    )",
        "    AND LOWER(TRIM(c.company_name)) != LOWER(TRIM(h.company_name)); -- Alleen als niet exact match",
        "",
        "-- Stap 6: Cleanup temporary table",
        "DROP TABLE IF EXISTS hubspot_import;",
        "",
        "-- Klaar!",
    ])
    
    # Schrijf SQL naar bestand
    with open(output_sql_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_lines))
    
    print(f"✅ SQL script gegenereerd: {output_sql_path}")
    print(f"📊 {row_count} rijen verwerkt")
    print(f"\n📝 Volgende stap: Voer het SQL script uit in Supabase SQL Editor")

if __name__ == '__main__':
    import sys
    
    csv_file = '/Users/rogierschoenmakers/Downloads/hubspot-crm-exports-alle-bedrijven-ontbrekende-ge-2026-01-13 (1).csv'
    sql_file = '/Users/rogierschoenmakers/Documents/Platform/gs-lead-platform/import_hubspot_data.sql'
    
    if len(sys.argv) > 1:
        csv_file = sys.argv[1]
    if len(sys.argv) > 2:
        sql_file = sys.argv[2]
    
    generate_sql(csv_file, sql_file)
