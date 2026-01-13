import { useState, useEffect } from 'react'
import { BillingSnapshot } from '@/lib/billing/getSnapshot'

interface UseBillingSnapshotReturn {
  data: BillingSnapshot | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}

export function useBillingSnapshot(): UseBillingSnapshotReturn {
  const [data, setData] = useState<BillingSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSnapshot = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch('/api/billing/snapshot')
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to fetch billing snapshot')
      }
      
      const result = await response.json()
      setData(result.snapshot)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSnapshot()
  }, [])

  return {
    data,
    isLoading,
    error,
    refresh: fetchSnapshot
  }
}
