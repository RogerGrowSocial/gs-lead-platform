import { useState } from 'react'

interface UseQuotaMutationReturn {
  mutate: (leadsPerMonth: number) => Promise<void>
  isPending: boolean
  error: string | null
}

export function useQuotaMutation(): UseQuotaMutationReturn {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = async (leadsPerMonth: number) => {
    try {
      setIsPending(true)
      setError(null)
      
      const response = await fetch('/api/subscription/quota', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leadsPerMonth }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to update quota')
      }
      
      // Optionally return the updated data
      await response.json()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      throw err // Re-throw so components can handle it
    } finally {
      setIsPending(false)
    }
  }

  return {
    mutate,
    isPending,
    error
  }
}
