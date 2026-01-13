import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth/getUser'
import { updateQuota } from '@/lib/billing/updateQuota'
import { z } from 'zod'

const UpdateQuotaBodySchema = z.object({
  leadsPerMonth: z.number().int().min(0).max(100000)
})

export async function PUT(request: NextRequest) {
  try {
    const user = await getUser()
    const body = await request.json()
    const { leadsPerMonth } = UpdateQuotaBodySchema.parse(body)
    
    const result = await updateQuota(user.id, leadsPerMonth)
    
    return NextResponse.json({ ok: true, leadsPerMonth: result.leadsPerMonth })
  } catch (error) {
    console.error('Update quota error:', error)
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid input data', details: error.errors } },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update quota' } },
      { status: 500 }
    )
  }
}
