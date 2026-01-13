-- =====================================================
-- IMPORT MISSING INVOICES FROM E-BOEKHOUDEN
-- =====================================================
-- Total invoices: 75
-- Total amount: €60,222.42

BEGIN;

WITH invoice_data AS (
  SELECT * FROM (
    VALUES
    ('GS-0515', '2024-04-01'::date, '2024-04-15'::date, 'DTiG Beheer', 605.0, 0, 'paid', 'ORD-20240401', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 500.0, "has_vat": true, "subtotal": 500.0, "vat_amount": 105.0, "total": 605.0}]$$::jsonb),
    ('GS-0513', '2024-03-18'::date, '2024-04-01'::date, 'Jouwgeboortewijn', 907.5, 0, 'cancelled', 'ORD-20240318', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 750.0, "has_vat": false, "subtotal": 750.0, "vat_amount": 0, "total": 907.5}]$$::jsonb),
    ('GS-0509', '2024-03-18'::date, '2024-04-01'::date, 'Amsterdam Design', 1185.8, 0, 'paid', 'ORD-20240318', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 980.0, "has_vat": true, "subtotal": 980.0, "vat_amount": 205.79999999999995, "total": 1185.8}]$$::jsonb),
    ('GS-0508', '2024-03-18'::date, '2024-04-01'::date, 'The Workspot', 1548.8, 0, 'paid', 'ORD-20240318', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 1280.0, "has_vat": true, "subtotal": 1280.0, "vat_amount": 268.79999999999995, "total": 1548.8}]$$::jsonb),
    ('GS-0507', '2024-03-12'::date, '2024-03-26'::date, 'Jouwgeboortewijn', 907.5, 0, 'paid', 'ORD-20240312', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 750.0, "has_vat": true, "subtotal": 750.0, "vat_amount": 157.5, "total": 907.5}]$$::jsonb),
    ('GS-0506', '2024-03-12'::date, '2024-03-26'::date, 'Dakbeheer Acuut', 907.5, 0, 'paid', 'ORD-20240312', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 750.0, "has_vat": true, "subtotal": 750.0, "vat_amount": 157.5, "total": 907.5}]$$::jsonb),
    ('GS-0501', '2024-02-18'::date, '2024-03-03'::date, 'Jouwgeboortewijn', 907.5, 0, 'paid', 'ORD-20240218', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 750.0, "has_vat": true, "subtotal": 750.0, "vat_amount": 157.5, "total": 907.5}]$$::jsonb),
    ('GS-0494', '2024-01-19'::date, '2024-02-02'::date, 'Delaa-fit', 242.0, 0, 'paid', 'ORD-20240119', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 200.0, "has_vat": true, "subtotal": 200.0, "vat_amount": 42.0, "total": 242.0}]$$::jsonb),
    ('GS-0491', '2024-01-09'::date, '2024-01-23'::date, 'Delaa-fit', 242.0, 0, 'paid', 'ORD-20240109', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 200.0, "has_vat": true, "subtotal": 200.0, "vat_amount": 42.0, "total": 242.0}]$$::jsonb),
    ('GS-0490', '2024-01-08'::date, '2024-01-22'::date, 'When New Darkness Comes', 302.5, 0, 'paid', 'ORD-20240108', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 250.0, "has_vat": true, "subtotal": 250.0, "vat_amount": 52.5, "total": 302.5}]$$::jsonb),
    ('GS-0489', '2024-01-05'::date, '2024-01-19'::date, 'Amsterdam Design', 1566.95, 0, 'paid', 'ORD-20240105', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 1295.0, "has_vat": true, "subtotal": 1295.0, "vat_amount": 271.95000000000005, "total": 1566.95}]$$::jsonb),
    ('GS-0488', '2024-01-04'::date, '2024-01-18'::date, 'Dakbeheer Acuut', 907.5, 0, 'paid', 'ORD-20240104', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 750.0, "has_vat": true, "subtotal": 750.0, "vat_amount": 157.5, "total": 907.5}]$$::jsonb),
    ('GS-0486', '2023-12-21'::date, '2024-01-04'::date, 'Dakpreventie van der Steen', 561.92, 0, 'paid', 'ORD-20231221', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 464.4, "has_vat": true, "subtotal": 464.4, "vat_amount": 97.51999999999998, "total": 561.92}]$$::jsonb),
    ('GS-0485', '2023-12-12'::date, '2023-12-26'::date, 'Steck013', 133.1, 0, 'paid', 'ORD-20231212', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 110.0, "has_vat": true, "subtotal": 110.0, "vat_amount": 23.099999999999994, "total": 133.1}]$$::jsonb),
    ('GS-0484', '2023-12-12'::date, '2023-12-26'::date, 'Edelweiss Juwelier', 60.5, 0, 'paid', 'ORD-20231212', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 50.0, "has_vat": true, "subtotal": 50.0, "vat_amount": 10.5, "total": 60.5}]$$::jsonb),
    ('GS-0483', '2023-11-30'::date, '2023-12-14'::date, 'Lammy Yarns B.V.', 1439.9, 0, 'paid', 'ORD-20231130', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 1190.0, "has_vat": true, "subtotal": 1190.0, "vat_amount": 249.9000000000001, "total": 1439.9}]$$::jsonb),
    ('GS-0482', '2023-11-29'::date, '2023-12-13'::date, 'Dakbeheer Acuut', 605.0, 0, 'paid', 'ORD-20231129', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 500.0, "has_vat": true, "subtotal": 500.0, "vat_amount": 105.0, "total": 605.0}]$$::jsonb),
    ('GS-0479', '2023-11-24'::date, '2023-12-08'::date, 'Dakpreventie van der Steen', 561.92, 0, 'paid', 'ORD-20231124', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 464.4, "has_vat": true, "subtotal": 464.4, "vat_amount": 97.51999999999998, "total": 561.92}]$$::jsonb),
    ('GS-0478', '2023-11-23'::date, '2023-12-07'::date, 'The Workspot', 964.98, 0, 'paid', 'ORD-20231123', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 797.5, "has_vat": true, "subtotal": 797.5, "vat_amount": 167.48000000000002, "total": 964.98}]$$::jsonb),
    ('GS-0477', '2023-11-20'::date, '2023-12-04'::date, 'Steck013', 133.1, 0, 'paid', 'ORD-20231120', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 110.0, "has_vat": true, "subtotal": 110.0, "vat_amount": 23.099999999999994, "total": 133.1}]$$::jsonb),
    ('GS-0492', '2023-11-10'::date, '2023-11-24'::date, 'LIKE IT HARDER BOOKINGS', 360.0, 0, 'paid', 'ORD-20231110', 'Fee up the tempo', $$[{"description": "Fee up the tempo", "quantity": 1, "unit_price": 360.0, "has_vat": false, "subtotal": 360.0, "vat_amount": 0, "total": 360.0}]$$::jsonb),
    ('GS-0475', '2023-11-02'::date, '2023-11-16'::date, 'Jouwgeboortewijn', 907.5, 0, 'cancelled', 'ORD-20231102', 'Creditfactuur factuur: GS-0474', $$[{"description": "Creditfactuur factuur: GS-0474", "quantity": 1, "unit_price": 750.0, "has_vat": false, "subtotal": 750.0, "vat_amount": 0, "total": 907.5}]$$::jsonb),
    ('GS-0474', '2023-10-27'::date, '2023-11-10'::date, 'Jouwgeboortewijn', 907.5, 0, 'paid', 'ORD-20231027', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 750.0, "has_vat": true, "subtotal": 750.0, "vat_amount": 157.5, "total": 907.5}]$$::jsonb),
    ('GS-0472', '2023-10-27'::date, '2023-11-10'::date, 'Dakpreventie van der Steen', 561.92, 0, 'paid', 'ORD-20231027', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 464.4, "has_vat": true, "subtotal": 464.4, "vat_amount": 97.51999999999998, "total": 561.92}]$$::jsonb),
    ('GS-0471', '2023-10-19'::date, '2023-11-02'::date, 'Steck013', 133.1, 0, 'paid', 'ORD-20231019', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 110.0, "has_vat": true, "subtotal": 110.0, "vat_amount": 23.099999999999994, "total": 133.1}]$$::jsonb),
    ('GS-0470', '2023-10-19'::date, '2023-11-02'::date, 'Lammy Yarns B.V.', 290.0, 0, 'paid', 'ORD-20231019', 'Kosten automatische vertalingen website (weglot.com)', $$[{"description": "Kosten automatische vertalingen website (weglot.com)", "quantity": 1, "unit_price": 290.0, "has_vat": false, "subtotal": 290.0, "vat_amount": 0, "total": 290.0}]$$::jsonb),
    ('GS-0468', '2023-10-17'::date, '2023-10-31'::date, 'Lammy Yarns B.V.', 2395.8, 0, 'paid', 'ORD-20231017', 'Resterende betaling website lammy yarns', $$[{"description": "Resterende betaling website lammy yarns", "quantity": 1, "unit_price": 1980.0, "has_vat": true, "subtotal": 1980.0, "vat_amount": 415.8000000000002, "total": 2395.8}]$$::jsonb),
    ('GS-0467', '2023-10-17'::date, '2023-10-31'::date, 'B2S B.V.', 242.0, 0, 'paid', 'ORD-20231017', 'PO nummer: B22311SP.015 5150', $$[{"description": "PO nummer: B22311SP.015 5150", "quantity": 1, "unit_price": 200.0, "has_vat": true, "subtotal": 200.0, "vat_amount": 42.0, "total": 242.0}]$$::jsonb),
    ('GS-0465', '2023-09-26'::date, '2023-10-10'::date, 'Dakpreventie van der Steen', 561.92, 0, 'paid', 'ORD-20230926', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 464.4, "has_vat": true, "subtotal": 464.4, "vat_amount": 97.51999999999998, "total": 561.92}]$$::jsonb),
    ('GS-0464', '2023-09-13'::date, '2023-09-27'::date, 'Jouwgeboortewijn', 907.5, 0, 'paid', 'ORD-20230913', 'Factuur maandelijkse verbeteringen Oktober', $$[{"description": "Factuur maandelijkse verbeteringen Oktober", "quantity": 1, "unit_price": 750.0, "has_vat": true, "subtotal": 750.0, "vat_amount": 157.5, "total": 907.5}]$$::jsonb),
    ('GS-0463', '2023-09-13'::date, '2023-09-27'::date, 'Jouwgeboortewijn', 484.0, 0, 'paid', 'ORD-20230913', 'Factuur maandelijkse verbeteringen September', $$[{"description": "Factuur maandelijkse verbeteringen September", "quantity": 1, "unit_price": 400.0, "has_vat": true, "subtotal": 400.0, "vat_amount": 84.0, "total": 484.0}]$$::jsonb),
    ('GS-0462', '2023-09-13'::date, '2023-09-27'::date, 'Steck013', 133.1, 0, 'paid', 'ORD-20230913', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 110.0, "has_vat": true, "subtotal": 110.0, "vat_amount": 23.099999999999994, "total": 133.1}]$$::jsonb),
    ('GS-0461', '2023-09-08'::date, '2023-09-22'::date, 'Herbs & Touch', 1185.8, 0, 'paid', 'ORD-20230908', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 980.0, "has_vat": true, "subtotal": 980.0, "vat_amount": 205.79999999999995, "total": 1185.8}]$$::jsonb),
    ('GS-0460', '2023-08-31'::date, '2023-09-14'::date, 'The Workspot', 1185.8, 0, 'paid', 'ORD-20230831', 'Restbedrag website Werken Bij The Workspot', $$[{"description": "Restbedrag website Werken Bij The Workspot", "quantity": 1, "unit_price": 980.0, "has_vat": true, "subtotal": 980.0, "vat_amount": 205.79999999999995, "total": 1185.8}]$$::jsonb),
    ('GS-0458', '2023-08-31'::date, '2023-09-14'::date, 'Dakpreventie van der Steen', 561.92, 0, 'paid', 'ORD-20230831', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 464.4, "has_vat": true, "subtotal": 464.4, "vat_amount": 97.51999999999998, "total": 561.92}]$$::jsonb),
    ('GS-0457', '2023-08-17'::date, '2023-08-31'::date, 'Dakmeester Nederland', 1439.9, 0, 'paid', 'ORD-20230817', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 1190.0, "has_vat": true, "subtotal": 1190.0, "vat_amount": 249.9000000000001, "total": 1439.9}]$$::jsonb),
    ('GS-0455', '2023-07-30'::date, '2023-08-13'::date, 'The Workspot', 1185.8, 0, 'paid', 'ORD-20230730', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 980.0, "has_vat": true, "subtotal": 980.0, "vat_amount": 205.79999999999995, "total": 1185.8}]$$::jsonb),
    ('GS-0454', '2023-07-29'::date, '2023-08-12'::date, 'Herbs & Touch', 1185.8, 0, 'paid', 'ORD-20230729', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 980.0, "has_vat": true, "subtotal": 980.0, "vat_amount": 205.79999999999995, "total": 1185.8}]$$::jsonb),
    ('GS-0452', '2023-07-28'::date, '2023-08-11'::date, 'Anderson Chikie', 592.9, 0, 'paid', 'ORD-20230728', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 490.0, "has_vat": true, "subtotal": 490.0, "vat_amount": 102.89999999999998, "total": 592.9}]$$::jsonb),
    ('GS-0451', '2023-07-27'::date, '2023-08-10'::date, 'Jouwgeboortewijn', 484.0, 0, 'paid', 'ORD-20230727', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 400.0, "has_vat": true, "subtotal": 400.0, "vat_amount": 84.0, "total": 484.0}]$$::jsonb),
    ('GS-0450', '2023-07-27'::date, '2023-08-10'::date, 'Jouwgeboortewijn', 834.9, 0, 'paid', 'ORD-20230727', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 690.0, "has_vat": true, "subtotal": 690.0, "vat_amount": 144.89999999999998, "total": 834.9}]$$::jsonb),
    ('GS-0449', '2023-07-25'::date, '2023-08-08'::date, 'Dakpreventie van der Steen', 561.92, 0, 'paid', 'ORD-20230725', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 464.4, "has_vat": true, "subtotal": 464.4, "vat_amount": 97.51999999999998, "total": 561.92}]$$::jsonb),
    ('GS-0448', '2023-07-25'::date, '2023-08-08'::date, 'Dakmeester Nederland', 1439.9, 0, 'paid', 'ORD-20230725', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 1190.0, "has_vat": true, "subtotal": 1190.0, "vat_amount": 249.9000000000001, "total": 1439.9}]$$::jsonb),
    ('GS-0447', '2023-07-04'::date, '2023-07-18'::date, 'Jd-dakexpert', 1439.9, 0, 'paid', 'ORD-20230704', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 1190.0, "has_vat": true, "subtotal": 1190.0, "vat_amount": 249.9000000000001, "total": 1439.9}]$$::jsonb),
    ('GS-0446', '2023-07-04'::date, '2023-07-18'::date, 'Dakmeester Nederland', 1439.9, 0, 'paid', 'ORD-20230704', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 1190.0, "has_vat": true, "subtotal": 1190.0, "vat_amount": 249.9000000000001, "total": 1439.9}]$$::jsonb),
    ('GS-0445', '2023-07-04'::date, '2023-07-18'::date, 'Dak & Geveltechniek Nederland', 605.0, 0, 'paid', 'ORD-20230704', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 500.0, "has_vat": true, "subtotal": 500.0, "vat_amount": 105.0, "total": 605.0}]$$::jsonb),
    ('GS-0443', '2023-06-29'::date, '2023-07-13'::date, 'Dakpreventie van der Steen', 561.92, 0, 'paid', 'ORD-20230629', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 464.4, "has_vat": true, "subtotal": 464.4, "vat_amount": 97.51999999999998, "total": 561.92}]$$::jsonb),
    ('GS-0441', '2023-06-23'::date, '2023-07-07'::date, 'Lammy Yarns B.V.', 2395.8, 0, 'paid', 'ORD-20230623', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 1980.0, "has_vat": true, "subtotal": 1980.0, "vat_amount": 415.8000000000002, "total": 2395.8}]$$::jsonb),
    ('GS-0440', '2023-06-22'::date, '2023-07-06'::date, 'Oranjebos Vastgoed B.V.', 907.5, 0, 'paid', 'ORD-20230622', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 750.0, "has_vat": true, "subtotal": 750.0, "vat_amount": 157.5, "total": 907.5}]$$::jsonb),
    ('GS-0434', '2023-06-12'::date, '2023-06-26'::date, 'Steck013', 133.1, 0, 'paid', 'ORD-20230612', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 110.0, "has_vat": true, "subtotal": 110.0, "vat_amount": 23.099999999999994, "total": 133.1}]$$::jsonb),
    ('GS-0435', '2023-06-06'::date, '2023-06-20'::date, 'DTiG Beheer', 907.5, 0, 'paid', 'ORD-20230606', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 750.0, "has_vat": true, "subtotal": 750.0, "vat_amount": 157.5, "total": 907.5}]$$::jsonb),
    ('GS-0444', '2023-06-01'::date, '2023-06-15'::date, 'Dakpreventie van der Steen', 561.92, 0, 'paid', 'ORD-20230601', 'Opmerking: deze factuur is al betaald door dakpreventie van der Steen.', $$[{"description": "Opmerking: deze factuur is al betaald door dakpreventie van der Steen.", "quantity": 1, "unit_price": 464.4, "has_vat": true, "subtotal": 464.4, "vat_amount": 97.51999999999998, "total": 561.92}]$$::jsonb),
    ('GS-0433', '2023-05-09'::date, '2023-05-23'::date, 'Dakpreventie van der Steen', 561.92, 0, 'paid', 'ORD-20230509', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 464.4, "has_vat": true, "subtotal": 464.4, "vat_amount": 97.51999999999998, "total": 561.92}]$$::jsonb),
    ('GS-0432', '2023-05-09'::date, '2023-05-23'::date, 'Steck013', 133.1, 0, 'paid', 'ORD-20230509', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 110.0, "has_vat": true, "subtotal": 110.0, "vat_amount": 23.099999999999994, "total": 133.1}]$$::jsonb),
    ('GS-0431', '2023-05-08'::date, '2023-05-22'::date, 'Dak & Geveltechniek Nederland', 4660.92, 0, 'paid', 'ORD-20230508', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 3852.0, "has_vat": true, "subtotal": 3852.0, "vat_amount": 808.9200000000001, "total": 4660.92}]$$::jsonb),
    ('GS-0430', '2023-05-01'::date, '2023-05-15'::date, 'Dakpreventie van der Steen', 561.92, 0, 'paid', 'ORD-20230501', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 464.4, "has_vat": true, "subtotal": 464.4, "vat_amount": 97.51999999999998, "total": 561.92}]$$::jsonb),
    ('GS-0429', '2023-04-14'::date, '2023-04-28'::date, 'Steck013', 133.1, 0, 'paid', 'ORD-20230414', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 110.0, "has_vat": true, "subtotal": 110.0, "vat_amount": 23.099999999999994, "total": 133.1}]$$::jsonb),
    ('GS-0428', '2023-03-31'::date, '2023-04-14'::date, 'Dakpreventie van der Steen', 561.92, 0, 'paid', 'ORD-20230331', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 464.4, "has_vat": true, "subtotal": 464.4, "vat_amount": 97.51999999999998, "total": 561.92}]$$::jsonb),
    ('GS-0427', '2023-03-31'::date, '2023-04-14'::date, 'Dakpreventie van der Steen', 1790.8, 0, 'paid', 'ORD-20230331', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 1480.0, "has_vat": true, "subtotal": 1480.0, "vat_amount": 310.79999999999995, "total": 1790.8}]$$::jsonb),
    ('GS-0426', '2023-03-30'::date, '2023-04-13'::date, 'Dak & Geveltechniek Nederland', 261.0, 0, 'paid', 'ORD-20230330', 'Beste Ricardo de Vaan,Wij willen u hierbij herinneren aan de openstaande factuur van GrowSocial Marketing & Media met factuurnummer GS-0424. Deze factuur had u uiterlijk 14 dagen geleden moeten voldoen, maar tot op heden hebben wij nog geen betaling van u ontvangen. Zoals in onze algemene voorwaarden is beschreven (te lezen op onze website), zijn we genoodzaakt om een aanmaning te sturen.Wij begrijpen dat het soms kan gebeuren dat een betaling vertraagd is. Daarom geven wij u nogmaals de kans om', $$[{"description": "Beste Ricardo de Vaan,Wij willen u hierbij herinneren aan de openstaande factuur van GrowSocial Marketing & Media met factuurnummer GS-0424. Deze factuur had u uiterlijk 14 dagen geleden moeten voldoe", "quantity": 1, "unit_price": 215.7, "has_vat": true, "subtotal": 215.7, "vat_amount": 45.30000000000001, "total": 261.0}]$$::jsonb),
    ('GS-0423', '2023-03-15'::date, '2023-03-29'::date, 'Dakpreventie van der Steen', 1790.8, 0, 'paid', 'ORD-20230315', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 1480.0, "has_vat": true, "subtotal": 1480.0, "vat_amount": 310.79999999999995, "total": 1790.8}]$$::jsonb),
    ('GS-0422', '2023-03-13'::date, '2023-03-27'::date, 'Steck013', 133.1, 0, 'paid', 'ORD-20230313', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 110.0, "has_vat": true, "subtotal": 110.0, "vat_amount": 23.099999999999994, "total": 133.1}]$$::jsonb),
    ('GS-0425', '2023-03-08'::date, '2023-03-22'::date, 'Dak & Geveltechniek Nederland', 1354.5, 0, 'paid', 'ORD-20230308', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 1119.42, "has_vat": true, "subtotal": 1119.42, "vat_amount": 235.07999999999993, "total": 1354.5}]$$::jsonb),
    ('GS-0424', '2023-03-03'::date, '2023-03-17'::date, 'Dak & Geveltechniek Nederland', 1433.85, 0, 'paid', 'ORD-20230303', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 1185.0, "has_vat": true, "subtotal": 1185.0, "vat_amount": 248.8499999999999, "total": 1433.85}]$$::jsonb),
    ('GS-0419', '2023-02-13'::date, '2023-02-27'::date, 'Steck013', 133.1, 0, 'paid', 'ORD-20230213', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 110.0, "has_vat": true, "subtotal": 110.0, "vat_amount": 23.099999999999994, "total": 133.1}]$$::jsonb),
    ('GS-0418', '2023-02-10'::date, '2023-02-24'::date, 'Dak & Geveltechniek Nederland', 545.0, 0, 'paid', 'ORD-20230210', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 500.0, "has_vat": true, "subtotal": 500.0, "vat_amount": 45.0, "total": 545.0}]$$::jsonb),
    ('GS-0417', '2023-01-19'::date, '2023-02-02'::date, 'Steck013', 133.1, 0, 'paid', 'ORD-20230119', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 110.0, "has_vat": true, "subtotal": 110.0, "vat_amount": 23.099999999999994, "total": 133.1}]$$::jsonb),
    ('GS-0416', '2022-12-19'::date, '2023-01-02'::date, 'Steck013', 133.1, 0, 'paid', 'ORD-20221219', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 110.0, "has_vat": true, "subtotal": 110.0, "vat_amount": 23.099999999999994, "total": 133.1}]$$::jsonb),
    ('GS-0415', '2022-12-19'::date, '2023-01-02'::date, 'Koos Kluytmans Interieurs B.V.', 605.0, 0, 'paid', 'ORD-20221219', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 500.0, "has_vat": true, "subtotal": 500.0, "vat_amount": 105.0, "total": 605.0}]$$::jsonb),
    ('GS-0412', '2022-11-29'::date, '2022-12-13'::date, 'Koos Kluytmans Interieurs B.V.', 816.75, 0, 'paid', 'ORD-20221129', 'Tweede helft factuur SEO performance.', $$[{"description": "Tweede helft factuur SEO performance.", "quantity": 1, "unit_price": 675.0, "has_vat": true, "subtotal": 675.0, "vat_amount": 141.75, "total": 816.75}]$$::jsonb),
    ('ST1410', '2022-11-26'::date, '2022-12-10'::date, 'Steck013', 133.1, 0, 'paid', 'ORD-20221126', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 110.0, "has_vat": true, "subtotal": 110.0, "vat_amount": 23.099999999999994, "total": 133.1}]$$::jsonb),
    ('ST1409', '2022-11-26'::date, '2022-12-10'::date, 'Koos Kluytmans Interieurs B.V.', 605.0, 0, 'paid', 'ORD-20221126', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 500.0, "has_vat": true, "subtotal": 500.0, "vat_amount": 105.0, "total": 605.0}]$$::jsonb),
    ('KK9128', '2022-11-17'::date, '2022-12-01'::date, 'Koos Kluytmans Interieurs B.V.', 816.75, 0, 'paid', 'ORD-20221117', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 675.0, "has_vat": true, "subtotal": 675.0, "vat_amount": 141.75, "total": 816.75}]$$::jsonb),
    ('ST1407', '2022-11-01'::date, '2022-11-15'::date, 'Steck013', 133.1, 0, 'paid', 'ORD-20221101', 'Geïmporteerd uit e-boekhouden', $$[{"description": "Dienstverlening", "quantity": 1, "unit_price": 110.0, "has_vat": true, "subtotal": 110.0, "vat_amount": 23.099999999999994, "total": 133.1}]$$::jsonb),
    ('KK9124', '2022-10-27'::date, '2022-11-10'::date, 'Koos Kluytmans Interieurs B.V.', 605.0, 0, 'paid', 'ORD-20221027', 'Beste Jack, hieronder volgt de factuur voor het onderhoud aan alle sites van de aankomende maand.', $$[{"description": "Beste Jack, hieronder volgt de factuur voor het onderhoud aan alle sites van de aankomende maand.", "quantity": 1, "unit_price": 500.0, "has_vat": true, "subtotal": 500.0, "vat_amount": 105.0, "total": 605.0}]$$::jsonb)
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
    line_items
  )
),
customer_mapping AS (
  SELECT DISTINCT
    id.customer_name,
    c.id AS customer_id
  FROM invoice_data id
  LEFT JOIN public.customers c
    ON c.company_name ILIKE '%' || id.customer_name || '%'
    OR c.name ILIKE '%' || id.customer_name || '%'
),
-- Create missing customers
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
      WHERE c.company_name ILIKE '%' || cm.customer_name || '%'
      OR c.name ILIKE '%' || cm.customer_name || '%'
    )
  RETURNING id, company_name
),
-- Update customer_mapping with newly created customers
updated_customer_mapping AS (
  SELECT DISTINCT
    cm.customer_name,
    COALESCE(
      cm.customer_id,
      nc.id,
      (SELECT id FROM public.customers
       WHERE company_name ILIKE '%' || cm.customer_name || '%'
       OR name ILIKE '%' || cm.customer_name || '%'
       LIMIT 1)
    ) AS customer_id
  FROM customer_mapping cm
  LEFT JOIN new_customers nc
    ON nc.company_name ILIKE '%' || cm.customer_name || '%'
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
    id.notes,
    id.line_items,
    id.invoice_number AS external_id,
    'eboekhouden' AS external_system
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

-- Imported 75 invoices
