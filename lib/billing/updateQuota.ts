import { createServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const UpdateQuotaSchema = z.object({
  leadsPerMonth: z.number().int().min(0).max(100000)
})

export async function updateQuota(userId: string, leadsPerMonth: number) {
  const validatedData = UpdateQuotaSchema.parse({ leadsPerMonth })
  const supabase = createServerClient()
  
  // First, check if user has an active subscription
  const { data: existingSubscription, error: fetchError } = await supabase
    .from('subscriptions')
    .select('id, leads_per_month')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  
  if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw new Error(`Failed to fetch existing subscription: ${fetchError.message}`)
  }
  
  if (existingSubscription) {
    // Update existing subscription
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({ leads_per_month: validatedData.leadsPerMonth })
      .eq('id', existingSubscription.id)
    
    if (updateError) {
      throw new Error(`Failed to update subscription: ${updateError.message}`)
    }
  } else {
    // Create new subscription
    const { error: insertError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        leads_per_month: validatedData.leadsPerMonth,
        status: 'active'
      })
    
    if (insertError) {
      throw new Error(`Failed to create subscription: ${insertError.message}`)
    }
  }
  
  return { leadsPerMonth: validatedData.leadsPerMonth }
}
