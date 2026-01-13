const prisma = require('../config/prisma');
const { generateInvoiceNumber, createInvoicePDF } = require('./invoiceService');
const { sendEmail } = require('./emailService');

/**
 * Generates monthly invoices for all active subscriptions
 * @returns {Promise<Array>} Array of created invoices
 */
async function generateMonthlyInvoices() {
  try {
    // Get all active subscriptions
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active',
        end_date: {
          gte: new Date() // Only include subscriptions that haven't ended
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            company_name: true,
            first_name: true,
            last_name: true,
            address: true,
            postal_code: true,
            city: true,
            country: true,
            vat_number: true,
            kvk_number: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true,
            price_per_lead: {
              select: {
                price_euro: true
              }
            }
          }
        }
      }
    });

    const createdInvoices = [];

    for (const subscription of activeSubscriptions) {
      // Calculate invoice amount based on leads_per_month and price_per_lead
      const pricePerLead = subscription.branch.price_per_lead.price_euro;
      const amount = subscription.leads_per_month * pricePerLead;
      const vatAmount = amount * 0.21; // 21% BTW
      const totalAmount = amount + vatAmount;

      // Generate invoice number
      const invoiceNumber = generateInvoiceNumber();

      // Set due date to 14 days from now
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);

      // Create invoice record
      const invoice = await prisma.invoice.create({
        data: {
          user_id: subscription.user.id,
          subscription_id: subscription.id,
          invoice_number: invoiceNumber,
          amount: amount,
          vat_amount: vatAmount,
          total_amount: totalAmount,
          status: 'pending',
          due_date: dueDate,
          description: `Maandelijkse factuur voor ${subscription.branch.name} - ${subscription.leads_per_month} leads`
        }
      });

      // Generate and upload PDF
      const pdfUrl = await createInvoicePDF({
        invoice_number: invoiceNumber,
        user: subscription.user,
        date: new Date().toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        subtotal: amount,
        vat: vatAmount,
        total: totalAmount,
        items: [{
          description: `${subscription.leads_per_month} leads voor ${subscription.branch.name}`,
          quantity: subscription.leads_per_month,
          unit_price: pricePerLead,
          total: amount
        }]
      });

      // Update invoice with PDF URL
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { pdf_url: pdfUrl }
      });

      // Send invoice email to user
      await sendEmail({
        to: subscription.user.email,
        subject: `Nieuwe factuur ${invoiceNumber} - GrowSocial`,
        template: 'invoice_notification',
        data: {
          invoice_number: invoiceNumber,
          company_name: subscription.user.company_name,
          amount: totalAmount.toFixed(2),
          due_date: dueDate.toISOString().split('T')[0],
          pdf_url: pdfUrl
        }
      });

      createdInvoices.push(invoice);
    }

    // Send admin notification about generated invoices
    if (createdInvoices.length > 0) {
      await sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: `Maandelijkse facturen gegenereerd - ${createdInvoices.length} facturen`,
        template: 'admin_invoice_report',
        data: {
          invoice_count: createdInvoices.length,
          total_amount: createdInvoices.reduce((sum, inv) => sum + inv.total_amount, 0).toFixed(2),
          invoices: createdInvoices.map(inv => ({
            number: inv.invoice_number,
            amount: inv.total_amount.toFixed(2),
            due_date: inv.due_date.toISOString().split('T')[0]
          }))
        }
      });
    }

    return createdInvoices;
  } catch (error) {
    console.error('Error generating monthly invoices:', error);
    throw error;
  }
}

/**
 * Sends payment reminders for overdue invoices
 * @returns {Promise<Array>} Array of reminded invoices
 */
async function sendPaymentReminders() {
  try {
    const today = new Date();
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: 'pending',
        due_date: {
          lt: today
        }
      },
      include: {
        user: {
          select: {
            email: true,
            company_name: true,
            first_name: true,
            last_name: true
          }
        }
      }
    });

    const remindedInvoices = [];

    for (const invoice of overdueInvoices) {
      // Calculate days overdue
      const daysOverdue = Math.floor((today - invoice.due_date) / (1000 * 60 * 60 * 24));

      // Send reminder email
      await sendEmail({
        to: invoice.user.email,
        subject: `Betalingsherinnering - Factuur ${invoice.invoice_number}`,
        template: 'payment_reminder',
        data: {
          invoice_number: invoice.invoice_number,
          company_name: invoice.user.company_name,
          amount: invoice.total_amount.toFixed(2),
          due_date: invoice.due_date.toISOString().split('T')[0],
          days_overdue: daysOverdue,
          pdf_url: invoice.pdf_url
        }
      });

      remindedInvoices.push(invoice);
    }

    return remindedInvoices;
  } catch (error) {
    console.error('Error sending payment reminders:', error);
    throw error;
  }
}

module.exports = {
  generateMonthlyInvoices,
  sendPaymentReminders
}; 