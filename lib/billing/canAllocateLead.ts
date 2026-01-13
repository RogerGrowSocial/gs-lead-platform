import { createServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const CanAllocateSchema = z.object({
  price: z.number().min(0)
})

export type AllocateResult = 'OK' | 'QUOTA_REACHED' | 'INSUFFICIENT_FUNDS'

export async function canAllocateLead(userId: string, price: number): Promise<AllocateResult> {
  const validatedData = CanAllocateSchema.parse({ price })
  const supabase = createServerClient()
  
  const { data, error } = await supabase.rpc('can_allocate_lead', {
    p_user: userId,
    p_price: validatedData.price
  })
  
  if (error) {
    throw new Error(`Failed to check lead allocation: ${error.message}`)
  }
  
  return data as AllocateResult
}
