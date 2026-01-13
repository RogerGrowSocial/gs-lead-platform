const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');
const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../config/supabase');

// 1. Factuurnummer generator
function generateInvoiceNumber() {
  const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `GS-${date}-${random}`;
}

// 2. HTML template loader
async function loadTemplate() {
  const templatePath = path.resolve(process.cwd(), 'templates', 'invoice.html');
  return fs.readFile(templatePath, 'utf-8');
}

// Helper functie om company settings op te halen
async function getCompanySettings() {
  try {
    const { data, error } = await supabaseAdmin
      .from('company_settings')
      .select('*')
      .eq('id', 1)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching company settings:', error);
      // Return defaults
      return {
        company_name: 'GrowSocial',
        address: 'Monseigneur Bekkersplein 2',
        postal_code: '5076 AV',
        city: 'Haaren Noord-Brabant',
        country: 'Netherlands',
        phone: '0132340434',
        email: 'info@growsocialmedia.nl',
        website: 'growsocialmedia.nl',
        kvk_number: '76478793',
        vat_number: 'NL860638285B01',
        iban: 'NL42RABO0357384644',
        logo_url: null
      };
    }
    
    return data || {
      company_name: 'GrowSocial',
      address: 'Monseigneur Bekkersplein 2',
      postal_code: '5076 AV',
      city: 'Haaren Noord-Brabant',
      country: 'Netherlands',
      phone: '0132340434',
      email: 'info@growsocialmedia.nl',
      website: 'growsocialmedia.nl',
      kvk_number: '76478793',
      vat_number: 'NL860638285B01',
      iban: 'NL42RABO0357384644',
      logo_url: null
    };
  } catch (error) {
    console.error('Error in getCompanySettings:', error);
    // Return defaults on error
    return {
      company_name: 'GrowSocial',
      address: 'Monseigneur Bekkersplein 2',
      postal_code: '5076 AV',
      city: 'Haaren Noord-Brabant',
      country: 'Netherlands',
      phone: '0132340434',
      email: 'info@growsocialmedia.nl',
      website: 'growsocialmedia.nl',
      kvk_number: '76478793',
      vat_number: 'NL860638285B01',
      iban: 'NL42RABO0357384644',
      logo_url: null
    };
  }
}

// 3. PDF render (zonder upload - retourneert alleen buffer)
async function generateInvoicePDFBuffer(invoiceData) {
  try {
    // Haal company settings op
    const companySettings = await getCompanySettings();
    
    // Laad de template
    const htmlTemplate = await loadTemplate();
    
    // Prepare template replacements
    const replacements = {
      invoice_number: invoiceData.invoice_number || '',
      date: invoiceData.date || '',
      due_date: invoiceData.due_date || invoiceData.date || '',
      company_name: companySettings.company_name || 'GrowSocial',
      address: companySettings.address || '',
      city: companySettings.city || '',
      postal_code: companySettings.postal_code || '',
      country: companySettings.country || 'Netherlands',
      phone: companySettings.phone || '',
      email: companySettings.email || '',
      website: companySettings.website || '',
      kvk_number: companySettings.kvk_number || '',
      vat_number: companySettings.vat_number || '',
      iban: companySettings.iban || '',
      logo_url: (() => {
        const baseUrl = process.env.APP_URL || process.env.BASE_URL || 'http://localhost:3000';
        const logoUrl = companySettings.logo_url || '/img/gs-logo-oranje.jpg';
        return logoUrl.startsWith('http') ? logoUrl : `${baseUrl}${logoUrl}`;
      })(),
      logo_display: 'block',
      user: {
        company_name: invoiceData.user?.company_name || '',
        address: invoiceData.user?.address || '',
        city: invoiceData.user?.city || '',
        postal_code: invoiceData.user?.postal_code || ''
      },
      subject: invoiceData.subject || `Betaling #${invoiceData.invoice_number || ''}`,
      reference_id: invoiceData.reference_id || invoiceData.invoice_number || '',
      payment_method: invoiceData.payment_method || 'SEPA Automatische Incasso',
      payment_status: invoiceData.payment_status || 'Betaald',
      payment_date: invoiceData.payment_date || invoiceData.date || '',
      subtotal: (invoiceData.subtotal || 0).toFixed(2).replace('.', ','),
      vat: (invoiceData.vat || 0).toFixed(2).replace('.', ','),
      total: (invoiceData.total || 0).toFixed(2).replace('.', ','),
      phone_line: companySettings.phone ? `Tel: ${companySettings.phone}<br>` : '',
      email_line: companySettings.email ? `Email: ${companySettings.email}<br>` : '',
      website_line: companySettings.website ? `Website: ${companySettings.website}<br>` : '',
      kvk_line: companySettings.kvk_number ? `KvK: ${companySettings.kvk_number}<br>` : '',
      vat_line: companySettings.vat_number ? `BTW: ${companySettings.vat_number}<br>` : '',
      iban_line: companySettings.iban ? `IBAN: ${companySettings.iban}` : '',
      facturen_email: 'facturen@growsocialmedia.nl',
      items: generateItemsHtml(invoiceData.items || [])
    };
    
    // Vul de template met invoiceData en company settings
    let filledHtml = htmlTemplate
      .replace(/{{invoice_number}}/g, replacements.invoice_number)
      .replace(/{{date}}/g, replacements.date)
      .replace(/{{due_date}}/g, replacements.due_date)
      .replace(/{{company_name}}/g, replacements.company_name)
      .replace(/{{address}}/g, replacements.address)
      .replace(/{{city}}/g, replacements.city)
      .replace(/{{postal_code}}/g, replacements.postal_code)
      .replace(/{{country}}/g, replacements.country)
      .replace(/{{logo_url}}/g, replacements.logo_url)
      .replace(/{{logo_display}}/g, replacements.logo_display)
      .replace(/{{phone_line}}/g, replacements.phone_line)
      .replace(/{{email_line}}/g, replacements.email_line)
      .replace(/{{website_line}}/g, replacements.website_line)
      .replace(/{{kvk_line}}/g, replacements.kvk_line)
      .replace(/{{vat_line}}/g, replacements.vat_line)
      .replace(/{{iban_line}}/g, replacements.iban_line)
      .replace(/{{facturen_email}}/g, replacements.facturen_email)
      .replace(/{{user\.company_name}}/g, replacements.user.company_name)
      .replace(/{{user\.address}}/g, replacements.user.address)
      .replace(/{{user\.city}}/g, replacements.user.city)
      .replace(/{{user\.postal_code}}/g, replacements.user.postal_code)
      .replace(/{{subject}}/g, replacements.subject)
      .replace(/{{reference_id}}/g, replacements.reference_id)
      .replace(/{{payment_method}}/g, replacements.payment_method)
      .replace(/{{payment_status}}/g, replacements.payment_status)
      .replace(/{{payment_date}}/g, replacements.payment_date)
      .replace(/{{subtotal}}/g, replacements.subtotal)
      .replace(/{{vat}}/g, replacements.vat)
      .replace(/{{total}}/g, replacements.total)
      .replace(/{{items}}/g, replacements.items);

    // Start headless Chrome
    const browser = await puppeteer.launch({ 
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      headless: 'new'
    });
    const page = await browser.newPage();
    
    // Set viewport voor consistent rendering
    await page.setViewport({ width: 1200, height: 1600 });
    
    // Load HTML met timeout
    await page.setContent(filledHtml, { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wacht even voor CSS rendering (gebruik promise-based timeout)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Genereer PDF
    const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      }
    });
    
    await browser.close();

    // Valideer dat de buffer bestaat en niet leeg is
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Generated PDF buffer is empty');
    }

    console.log(`✅ PDF generated successfully: ${pdfBuffer.length} bytes`);
    return pdfBuffer;
  } catch (error) {
    console.error('Error in generateInvoicePDFBuffer:', error);
    throw error;
  }
}

// 4. PDF render + upload (behoud backward compatibility)
async function createInvoicePDF(invoiceData) {
  try {
    const pdfBuffer = await generateInvoicePDFBuffer(invoiceData);

    // Try to upload naar Supabase Storage, maar skip als bucket niet bestaat
    try {
      const filePath = `invoices/${invoiceData.invoice_number}.pdf`;
      const { error: uploadError } = await supabaseAdmin
        .storage
        .from('pdfs')
        .upload(filePath, pdfBuffer, { 
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadError) {
        // Als bucket niet bestaat, skip upload maar geen error gooien
        if (uploadError.statusCode === '404' || uploadError.message?.includes('not found')) {
          console.warn('PDF storage bucket not found, skipping upload (non-critical)');
          // Return a placeholder URL - the PDF will still be downloadable directly
          return null;
        } else {
          console.error('Error uploading PDF:', uploadError);
          // Don't throw - allow direct download to work
          return null;
        }
      }

      // Haal de public URL op
      const { data: { publicUrl } } = supabaseAdmin
        .storage
        .from('pdfs')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (storageError) {
      // Als storage niet beschikbaar is, skip het maar geen error
      console.warn('Storage upload failed (non-critical):', storageError.message);
      return null;
    }
  } catch (error) {
    console.error('Error in createInvoicePDF:', error);
    // Don't throw - allow direct download to work
    return null;
  }
}

// Helper functie om items HTML te genereren
function generateItemsHtml(items) {
  return items.map((item, index) => {
    const description = item.description || '';
    const descriptionSecondary = item.description_secondary || '';
    const quantity = (item.quantity || 1).toFixed(2).replace('.', ',');
    const unitPrice = (item.unit_price || 0).toFixed(2).replace('.', ',');
    const total = (item.total || 0).toFixed(2).replace('.', ',');
    
    return `
    <tr class="invoice-tr">
      <td class="invoice-td invoice-td-description">
        <div class="invoice-item-title">${description}</div>
        ${descriptionSecondary ? `<div class="invoice-item-description">${descriptionSecondary}</div>` : ''}
      </td>
      <td class="invoice-td invoice-td-quantity">${quantity}</td>
      <td class="invoice-td invoice-td-price">€${unitPrice}</td>
      <td class="invoice-td invoice-td-total">€${total}</td>
    </tr>
  `;
  }).join('');
}

module.exports = {
  generateInvoiceNumber,
  createInvoicePDF,
  generateInvoicePDFBuffer
}; 