'use client'

import React, { useState } from 'react'
import { X, AlertTriangle, Loader2 } from 'lucide-react'

interface RefundModalProps {
  isOpen: boolean
  onClose: () => void
  payment: {
    payment_id: string
    customer_name: string
    amount_gross: number
    status: string
    created_at: string
  }
}

export default function RefundModal({ isOpen, onClose, payment }: RefundModalProps) {
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full')
  const [refundAmount, setRefundAmount] = useState('')
  const [reason, setReason] = useState('')
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
        setReason('')
        setRefundAmount('')
        setRefundType('full')
      }, 2000)
    } catch (error) {
      console.error('Error processing refund:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      onClose()
      setReason('')
      setRefundAmount('')
      setRefundType('full')
      setIsSuccess(false)
    }
  }

  const maxRefundAmount = payment.amount_gross / 100

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md sm:max-w-[550px] mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Terugbetaling verwerken</h2>
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
          {/* Warning Banner */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">Waarschuwing</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Terugbetalingen kunnen niet ongedaan worden gemaakt. Zorg ervoor dat alle gegevens correct zijn voordat u doorgaat.
                </p>
              </div>
            </div>
          </div>

          {/* Payment Details Summary */}
          <div className="bg-gray-50 p-4 rounded-lg" style={{ border: '0.5px solid #e5e7eb' }}>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Betalingsoverzicht</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Klant:</span>
                <span className="text-gray-900">{payment.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Origineel bedrag:</span>
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

          {/* Refund Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Type terugbetaling
            </label>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="refundType"
                  value="full"
                  checked={refundType === 'full'}
                  onChange={(e) => setRefundType(e.target.value as 'full' | 'partial')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-3 text-sm text-gray-900">
                  Volledige terugbetaling ({formatCurrency(payment.amount_gross)})
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="refundType"
                  value="partial"
                  checked={refundType === 'partial'}
                  onChange={(e) => setRefundType(e.target.value as 'full' | 'partial')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-3 text-sm text-gray-900">
                  Gedeeltelijke terugbetaling
                </span>
              </label>
            </div>
          </div>

          {/* Partial Refund Amount */}
          {refundType === 'partial' && (
            <div>
              <label htmlFor="refundAmount" className="block text-sm font-medium text-gray-700 mb-2">
                Terugbetalingsbedrag (€)
              </label>
              <input
                type="number"
                id="refundAmount"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                min="0.01"
                max={maxRefundAmount}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={`0.00 - ${maxRefundAmount.toFixed(2)}`}
                required={refundType === 'partial'}
              />
              <p className="mt-1 text-xs text-gray-500">
                Maximum: {formatCurrency(payment.amount_gross)}
              </p>
            </div>
          )}

          {/* Reason */}
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
              Reden voor terugbetaling *
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Beschrijf de reden voor deze terugbetaling..."
              required
            />
          </div>

          {/* Success Message */}
          {isSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-green-600 mr-2" />
                <span className="text-green-800">Terugbetaling succesvol verwerkt!</span>
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
              disabled={isLoading || !reason || (refundType === 'partial' && (!refundAmount || parseFloat(refundAmount) <= 0))}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verwerken...
                </>
              ) : (
                'Terugbetaling verwerken'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
