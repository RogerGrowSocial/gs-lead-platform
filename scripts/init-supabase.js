const supabase = require('../config/supabase')
const bcrypt = require('bcrypt')

async function initializeDatabase() {
  try {
    // Create users table
    const { error: usersError } = await supabase.from('users').select('*').limit(1)
    if (usersError && usersError.code === '42P01') { // Table doesn't exist
      const { error: createUsersError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE users (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            company_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            balance REAL DEFAULT 0,
            is_admin INTEGER DEFAULT 0,
            payment_method TEXT,
            has_payment_method INTEGER DEFAULT 0,
            last_login TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            status TEXT DEFAULT 'active'
          )
        `
      })
      if (createUsersError) {
        console.error('Error creating users table:', createUsersError)
        return
      }
    }
    console.log('Users table created or already exists')

    // Create leads table
    const { error: leadsError } = await supabase.from('leads').select('*').limit(1)
    if (leadsError && leadsError.code === '42P01') { // Table doesn't exist
      const { error: createLeadsError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE leads (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            message TEXT,
            user_id UUID REFERENCES users(id),
            status TEXT DEFAULT 'new',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `
      })
      if (createLeadsError) {
        console.error('Error creating leads table:', createLeadsError)
        return
      }
    }
    console.log('Leads table created or already exists')

    // Create payments table
    const { error: paymentsError } = await supabase.from('payments').select('*').limit(1)
    if (paymentsError && paymentsError.code === '42P01') { // Table doesn't exist
      const { error: createPaymentsError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE payments (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id),
            amount REAL NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `
      })
      if (createPaymentsError) {
        console.error('Error creating payments table:', createPaymentsError)
        return
      }
    }
    console.log('Payments table created or already exists')

    // Create indexes
    const { error: indexesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
        CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
      `
    })
    if (indexesError) {
      console.error('Error creating indexes:', indexesError)
      return
    }
    console.log('Indexes created or already exist')

    // Create admin user if it doesn't exist
    const { data: adminUser } = await supabase
      .from('users')
      .select()
      .eq('is_admin', 1)
      .single()

    if (!adminUser) {
      const hashedPassword = await bcrypt.hash('admin123', 10)
      const { error: adminError } = await supabase.from('users').insert({
        company_name: 'Admin',
        email: 'admin@example.com',
        password: hashedPassword,
        is_admin: 1,
        created_at: new Date().toISOString()
      })

      if (adminError) {
        console.error('Error creating admin user:', adminError)
        return
      }
      console.log('Admin user created')
    } else {
      console.log('Admin user already exists')
    }

    console.log('Database initialization completed successfully')
  } catch (error) {
    console.error('Error during database initialization:', error)
  }
}

initializeDatabase() 