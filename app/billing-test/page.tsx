'use client'

import { useState } from 'react'
import LeadQuotaSlider from '@/components/billing/LeadQuotaSlider'
import MonthlyUsageCard from '@/components/billing/MonthlyUsageCard'

export default function BillingTestPage() {
  const [testResults, setTestResults] = useState<string[]>([])

  const runTests = async () => {
    const results: string[] = []
    
    try {
      // Test 1: Billing Snapshot
      results.push('🧪 Testing billing snapshot...')
      const snapshotResponse = await fetch('/api/billing/snapshot')
      const snapshotData = await snapshotResponse.json()
      
      if (snapshotResponse.ok) {
        results.push('✅ Billing snapshot API works')
        results.push(`   Quota: ${snapshotData.snapshot?.monthly_quota || 0}`)
        results.push(`   Used: ${snapshotData.snapshot?.approved_count || 0}`)
        results.push(`   Balance: €${snapshotData.snapshot?.balance || 0}`)
      } else {
        results.push(`❌ Billing snapshot failed: ${snapshotData.error?.message}`)
      }
      
      // Test 2: Quota Update
      results.push('\n🧪 Testing quota update...')
      const quotaResponse = await fetch('/api/subscription/quota', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadsPerMonth: 100 })
      })
      const quotaData = await quotaResponse.json()
      
      if (quotaResponse.ok) {
        results.push('✅ Quota update API works')
        results.push(`   New quota: ${quotaData.leadsPerMonth}`)
      } else {
        results.push(`❌ Quota update failed: ${quotaData.error?.message}`)
      }
      
      // Test 3: Allocation Check
      results.push('\n🧪 Testing allocation check...')
      const allocateResponse = await fetch('/api/leads/allocate-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: 5.0 })
      })
      const allocateData = await allocateResponse.json()
      
      if (allocateResponse.ok) {
        results.push('✅ Allocation check API works')
        results.push(`   Result: ${allocateData.result}`)
      } else {
        results.push(`❌ Allocation check failed: ${allocateData.error?.message}`)
      }
      
    } catch (error) {
      results.push(`❌ Test error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    
    setTestResults(results)
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing API Test Page</h1>
        <p className="text-gray-600">Test de billing implementatie en componenten</p>
      </div>

      {/* API Tests */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">API Tests</h2>
          <button
            onClick={runTests}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Run Tests
          </button>
        </div>
        
        {testResults.length > 0 && (
          <div className="bg-gray-50 rounded-md p-4">
            <pre className="text-sm text-gray-800 whitespace-pre-wrap">
              {testResults.join('\n')}
            </pre>
          </div>
        )}
      </div>

      {/* Components */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyUsageCard />
        <LeadQuotaSlider />
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">Test Instructies</h3>
        <div className="text-blue-800 space-y-2">
          <p>1. <strong>Klik "Run Tests"</strong> om de API endpoints te testen</p>
          <p>2. <strong>Test de slider</strong> door de quota aan te passen</p>
          <p>3. <strong>Controleer de usage card</strong> voor maandelijkse statistieken</p>
          <p>4. <strong>Check de browser console</strong> voor eventuele errors</p>
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="bg-yellow-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-yellow-900 mb-3">Troubleshooting</h3>
        <div className="text-yellow-800 space-y-2">
          <p><strong>401 Unauthorized:</strong> Je bent niet ingelogd in Supabase</p>
          <p><strong>500 Internal Error:</strong> Database functies bestaan niet of hebben een fout</p>
          <p><strong>Component loading issues:</strong> Controleer browser console voor JavaScript errors</p>
        </div>
      </div>
    </div>
  )
}
