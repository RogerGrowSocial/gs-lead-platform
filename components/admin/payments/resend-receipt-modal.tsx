'use client'

import React, { useState } from 'react'
import { X, Mail, Loader2 } from 'lucide-react'

interface ResendReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  payment: {
    payment_id: string
    customer_name: string
    customer_email?: string
    amount_gross: number
    status: string
    created_at: string
  }
}

export default function ResendReceiptModal({ isOpen, onClose, payment }: ResendReceiptModalProps) {
  const [email, setEmail] = useState(payment.customer_email || '')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // TODO: Implement actual API call
      await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate API call
      
      setIsSuccess(true)
      setTimeout(() => {
        onClose()
        setIsSuccess(false)
        setMessage('')
      }, 2000)
    } catch (error) {
      console.error('Error resending receipt:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      onClose()
      setMessage('')
      setIsSuccess(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md sm:max-w-[500px] mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Ontvangstbevestiging opnieuw verzenden</h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Payment Details Summary */}
          <div className="bg-gray-50 p-4 rounded-lg" style={{ border: '0.5px solid #e5e7eb' }}>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Betalingsoverzicht</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Klant:</span>
                <span className="text-gray-900">{payment.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Bedrag:</span>
                <span className="text-gray-900">{formatCurrency(payment.amount_gross)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className="text-gray-900 capitalize">{payment.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Datum:</span>
                <span className="text-gray-900">{formatDate(payment.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              E-mailadres
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="klant@voorbeeld.nl"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Laat leeg om naar het standaard e-mailadres van de klant te verzenden
            </p>
          </div>

          {/* Message Input */}
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
              Bericht (optioneel)
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Voeg een persoonlijk bericht toe aan de e-mail..."
            />
          </div>

          {/* Success Message */}
          {isSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <Mail className="h-5 w-5 text-green-600 mr-2" />
                <span className="text-green-800">Ontvangstbevestiging succesvol verzonden!</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={isLoading || !email}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verzenden...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Verzenden
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
