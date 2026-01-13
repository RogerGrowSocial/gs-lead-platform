import { createServerClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function getUser(request?: NextRequest) {
  const supabase = createServerClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    throw new Error('Unauthorized', { cause: { status: 401 } })
  }
  
  return user
}
