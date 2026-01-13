'use client'

import { useBillingSnapshot } from '@/hooks/useBillingSnapshot'

export default function MonthlyUsageCard() {
  const { data: snapshot, isLoading, error } = useBillingSnapshot()

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-600">
          <p className="font-medium">Error loading usage data</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!snapshot) return null

  const usagePercentage = snapshot.monthly_quota > 0 ? (snapshot.approved_count / snapshot.monthly_quota) * 100 : 0
  const isCardPayment = snapshot.payment_method && ['card', 'credit'].includes(snapshot.payment_method.toLowerCase())

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Deze maand</h3>
        <span className="text-sm text-gray-500">{snapshot.period_month}</span>
      </div>

      {/* Usage Stats */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Gebruikte leads</span>
          <span className="text-2xl font-bold text-gray-900">
            {snapshot.approved_count}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-600">Quota</span>
          <span className="text-lg font-semibold text-gray-700">
            {snapshot.monthly_quota}
          </span>
        </div>

        {/* Progress Circle */}
        <div className="flex items-center justify-center py-4">
          <div className="relative w-24 h-24">
            <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-gray-200"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - usagePercentage / 100)}`}
                className={`transition-all duration-500 ${
                  usagePercentage >= 100
                    ? 'text-red-500'
                    : usagePercentage >= 80
                    ? 'text-yellow-500'
                    : 'text-green-500'
                }`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-gray-900">
                {Math.round(usagePercentage)}%
              </span>
            </div>
          </div>
        </div>

        {/* Amount Spent */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-gray-600">Uitgegeven bedrag</span>
          <span className="text-lg font-semibold text-gray-900">
            €{snapshot.approved_amount.toFixed(2)}
          </span>
        </div>

        {/* Balance (for card payments) */}
        {isCardPayment && (
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-gray-600">Huidig saldo</span>
            <span className={`text-lg font-semibold ${
              snapshot.balance <= 0 ? 'text-red-600' : 'text-gray-900'
            }`}>
              €{snapshot.balance.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Reset Info */}
      <div className="mt-6 pt-4 border-t">
        <div className="text-sm text-gray-500 text-center">
          <p className="font-medium">Reset op 1e dag volgende maand</p>
          <p className="mt-1">
            {isCardPayment ? (
              <>Creditcard: prepaid via saldo</>
            ) : (
              <>SEPA: afrekening einde maand</>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
