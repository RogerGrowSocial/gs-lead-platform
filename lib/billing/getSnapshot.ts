import { createServerClient } from '@/lib/supabase/server'

export type BillingSnapshot = {
  user_id: string
  period_month: string // YYYY-MM
  monthly_quota: number
  approved_count: number
  approved_amount: number
  balance: number
  payment_method: string | null
}

export async function getSnapshot(userId: string): Promise<BillingSnapshot> {
  const supabase = createServerClient()
  
  const { data, error } = await supabase.rpc('get_billing_snapshot', {
    p_user: userId
  })
  
  if (error) {
    throw new Error(`Failed to get billing snapshot: ${error.message}`)
  }
  
  if (!data) {
    throw new Error('No billing snapshot data returned')
  }
  
  return data as BillingSnapshot
}
