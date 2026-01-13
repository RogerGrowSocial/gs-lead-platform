'use client'

import { useState, useEffect } from 'react'
import { useBillingSnapshot } from '@/hooks/useBillingSnapshot'
import { useQuotaMutation } from '@/hooks/useQuotaMutation'

interface LeadQuotaSliderProps {
  initialQuota?: number
  onSaved?: (newQuota: number) => void
}

export default function LeadQuotaSlider({ initialQuota, onSaved }: LeadQuotaSliderProps) {
  const { data: snapshot, isLoading, error, refresh } = useBillingSnapshot()
  const { mutate: updateQuota, isPending, error: mutationError } = useQuotaMutation()
  
  const [quota, setQuota] = useState(initialQuota || 0)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    if (snapshot) {
      setQuota(snapshot.monthly_quota)
    }
  }, [snapshot])

  const handleQuotaChange = (newQuota: number) => {
    setQuota(newQuota)
    setHasUnsavedChanges(newQuota !== snapshot?.monthly_quota)
  }

  const handleSave = async () => {
    try {
      await updateQuota(quota)
      setHasUnsavedChanges(false)
      refresh() // Refresh the snapshot
      onSaved?.(quota)
    } catch (error) {
      console.error('Failed to save quota:', error)
    }
  }

  const handleTopUp = () => {
    // Placeholder for wallet top-up functionality
    window.location.href = '/wallet/topup'
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-600 mb-4">
          <p className="font-medium">Error loading billing data</p>
          <p className="text-sm">{error}</p>
        </div>
        <button
          onClick={refresh}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!snapshot) return null

  const usagePercentage = snapshot.monthly_quota > 0 ? (snapshot.approved_count / snapshot.monthly_quota) * 100 : 0
  const isCardPayment = snapshot.payment_method && ['card', 'credit'].includes(snapshot.payment_method.toLowerCase())
  const isLowBalance = isCardPayment && snapshot.balance <= 0
  const isQuotaReached = snapshot.approved_count >= snapshot.monthly_quota
  const isNearLimit = usagePercentage >= 80

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Lead Quota</h3>
        {isLowBalance && (
          <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
            Saldo te laag — eerst opwaarderen
          </span>
        )}
      </div>

      {/* Current Usage */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Huidige quota</span>
          <span className="font-medium">{snapshot.monthly_quota} leads/maand</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Gebruikt deze maand</span>
          <span className="font-medium">{snapshot.approved_count} leads</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              isQuotaReached
                ? 'bg-red-500'
                : isNearLimit
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
          />
        </div>

        {/* Status Messages */}
        {isQuotaReached && (
          <p className="text-sm text-red-600 font-medium">Limiet bereikt</p>
        )}
        {isNearLimit && !isQuotaReached && (
          <p className="text-sm text-yellow-600 font-medium">Bijna limiet bereikt (≥80%)</p>
        )}
      </div>

      {/* Quota Slider */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Leads per maand: {quota}
        </label>
        <input
          type="range"
          min="0"
          max="1000"
          value={quota}
          onChange={(e) => handleQuotaChange(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          disabled={isPending}
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>0</span>
          <span>1000</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={!hasUnsavedChanges || isPending}
          className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
            hasUnsavedChanges && !isPending
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isPending ? 'Opslaan...' : 'Opslaan'}
        </button>
        
        {isCardPayment && (
          <button
            onClick={handleTopUp}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            Saldo opwaarderen
          </button>
        )}
      </div>

      {/* Error Display */}
      {mutationError && (
        <div className="text-red-600 text-sm">
          <p className="font-medium">Error:</p>
          <p>{mutationError}</p>
        </div>
      )}

      {/* Payment Method Info */}
      <div className="text-xs text-gray-500 border-t pt-4">
        <p>
          <strong>SEPA:</strong> Afrekening einde maand · 
          <strong> Creditcard:</strong> Prepaid via saldo
        </p>
      </div>
    </div>
  )
}
