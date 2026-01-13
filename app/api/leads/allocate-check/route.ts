import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth/getUser'
import { canAllocateLead } from '@/lib/billing/canAllocateLead'
import { z } from 'zod'

const AllocateCheckBodySchema = z.object({
  price: z.number().min(0)
})

export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    const body = await request.json()
    const { price } = AllocateCheckBodySchema.parse(body)
    
    const result = await canAllocateLead(user.id, price)
    
    return NextResponse.json({ result })
  } catch (error) {
    console.error('Allocate check error:', error)
    
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
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to check allocation' } },
      { status: 500 }
    )
  }
}
