'use client'

import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Mail, Download, Printer } from 'lucide-react'

// Mock data structure (replace with real API call)
const mockPayment = {
  payment_id: "pay_1234567890abcdef",
  lead_id: "lead_abc123",
  lead_title: "Website ontwikkeling",
  customer_id: "cust_xyz789",
  customer_name: "Jan de Vries",
  amount_gross: 826,        // in cents
  amount_net: 950,
  fee_total: 124,
  vat_rate: 21,
  status: "paid",
  payment_method: "sepa_debit",
  iban_mask: "****1234",
  created_at: "2025-09-24T12:30:00Z",
  invoice_id: "inv_2025_001",
}

export default function InvoicePage() {
  const params = useParams()
  const router = useRouter()
  const payment = mockPayment // Replace with real data fetching

  const formatCurrency = (amountInCents: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR'
    }).format(amountInCents / 100)
  }

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('nl-NL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date(dateString))
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    // TODO: Implement PDF download
    console.log('Download PDF')
  }

  const handleEmail = () => {
    // TODO: Implement email functionality
    console.log('Email invoice')
  }

  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white;
          }
          @page {
            margin: 2cm;
          }
        }
      `}</style>

      {/* Action Bar (Hidden on Print) */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/admin/payments')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Terug naar betalingen
          </button>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleEmail}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg"
            >
              <Mail className="h-4 w-4" />
              E-mail
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-gray-900 hover:bg-gray-800 rounded-lg"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Content */}
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-5xl mx-auto p-16 print:p-12">
          <div className="bg-white rounded-lg shadow-sm" style={{ border: '0.5px solid #e5e7eb' }}>
            
            {/* Company Header */}
            <div className="p-8 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-5xl font-bold text-gray-900">FACTUUR</h1>
                  <p className="text-lg text-gray-600 mt-2">Factuurnummer: {payment.invoice_id}</p>
                </div>
                <div className="text-right">
                  <h2 className="text-2xl font-bold text-gray-900">GrowSocial</h2>
                  <p className="text-lg text-gray-600">Lead Platform</p>
                  <p className="text-sm text-gray-500 mt-4">
                    KvK: 12345678<br />
                    BTW: NL123456789B01<br />
                    info@growsocial.nl
                  </p>
                </div>
              </div>
            </div>

            {/* Customer Address */}
            <div className="p-8 bg-gray-50">
              <div className="text-sm uppercase tracking-wider text-gray-600 mb-2">Factuur aan</div>
              <div className="text-lg text-gray-900">
                <div className="font-medium">{payment.customer_name}</div>
                <div>Klant ID: {payment.customer_id}</div>
              </div>
            </div>

            {/* Invoice Items */}
            <div className="p-8">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-900">
                    <th className="text-left py-4 text-sm uppercase tracking-wider text-gray-600">Beschrijving</th>
                    <th className="text-right py-4 text-sm uppercase tracking-wider text-gray-600">Bedrag</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="py-8">
                      <div className="text-lg text-gray-900">{payment.lead_title}</div>
                      <div className="text-sm text-gray-600">Lead ID: {payment.lead_id}</div>
                      <div className="text-sm text-gray-600">Datum: {formatDate(payment.created_at)}</div>
                    </td>
                    <td className="py-8 text-right">
                      <div className="text-lg text-gray-900">{formatCurrency(payment.amount_gross)}</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="p-8 border-t border-gray-200">
              <div className="flex justify-end">
                <div className="w-96 space-y-4">
                  <div className="flex justify-between text-lg">
                    <span className="text-gray-600">Subtotaal</span>
                    <span className="text-gray-900">{formatCurrency(payment.amount_gross)}</span>
                  </div>
                  <div className="flex justify-between text-lg">
                    <span className="text-gray-600">BTW ({payment.vat_rate}%)</span>
                    <span className="text-gray-900">{formatCurrency(Math.round(payment.amount_gross * payment.vat_rate / 100))}</span>
                  </div>
                  <div className="flex justify-between text-2xl font-bold border-t border-gray-200 pt-4">
                    <span className="text-gray-900">Totaal</span>
                    <span className="text-gray-900">{formatCurrency(payment.amount_gross + Math.round(payment.amount_gross * payment.vat_rate / 100))}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="p-8 bg-gray-50 border-t border-gray-200">
              <div className="text-sm uppercase tracking-wider text-gray-600 mb-4">Betaalgegevens</div>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="text-sm text-gray-600">Betaalmethode</div>
                  <div className="text-lg text-gray-900">SEPA Incasso</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Status</div>
                  <div className="text-lg text-gray-900 capitalize">{payment.status}</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 border-t border-gray-200 text-center">
              <div className="text-sm text-gray-500">
                <p>Bedankt voor uw vertrouwen in GrowSocial</p>
                <p className="mt-2">Voor vragen kunt u contact opnemen via info@growsocial.nl</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
