import { useState } from 'react'
import { AllocateResult } from '@/lib/billing/canAllocateLead'

interface UseAllocateCheckReturn {
  checkAllocation: (price: number) => Promise<AllocateResult>
  isPending: boolean
  error: string | null
}

export function useAllocateCheck(): UseAllocateCheckReturn {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkAllocation = async (price: number): Promise<AllocateResult> => {
    try {
      setIsPending(true)
      setError(null)
      
      const response = await fetch('/api/leads/allocate-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ price }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to check allocation')
      }
      
      const result = await response.json()
      return result.result as AllocateResult
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      throw err // Re-throw so components can handle it
    } finally {
      setIsPending(false)
    }
  }

  return {
    checkAllocation,
    isPending,
    error
  }
}
