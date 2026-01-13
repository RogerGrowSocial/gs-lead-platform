import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth/getUser'
import { getSnapshot } from '@/lib/billing/getSnapshot'

export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    const snapshot = await getSnapshot(user.id)
    
    return NextResponse.json({ snapshot })
  } catch (error) {
    console.error('Billing snapshot error:', error)
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get billing snapshot' } },
      { status: 500 }
    )
  }
}
