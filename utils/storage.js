/**
 * Shared Supabase Storage utilities for Vercel uploads
 */
const { supabaseAdmin } = require('../config/supabase')

/**
 * Ensure storage bucket exists; create if not.
 * @param {string} bucketName - Bucket name (e.g. 'uploads')
 * @param {boolean} publicBucket - Whether bucket should be public (default: true)
 * @returns {Promise<boolean>} - True if bucket exists or was created
 */
async function ensureStorageBucket(bucketName, publicBucket = true) {
  try {
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
    if (listError) {
      console.error('Error listing buckets:', listError)
      return false
    }
    if (buckets?.some(b => b.name === bucketName)) return true

    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials for bucket creation')
      return false
    }

    const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({
        name: bucketName,
        public: publicBucket,
        file_size_limit: 52428800,
        allowed_mime_types: null
      })
    })

    if (!response.ok) {
      if (response.status === 409) return true
      console.error(`Failed to create bucket ${bucketName}:`, await response.text())
      return false
    }
    console.log(`✅ Created storage bucket: ${bucketName}`)
    return true
  } catch (e) {
    console.error('ensureStorageBucket error:', e)
    return false
  }
}

module.exports = { ensureStorageBucket }
