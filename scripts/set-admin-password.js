const supabase = require('../config/supabase')
const bcrypt = require('bcrypt')

async function setAdminPassword() {
  try {
    const hashedPassword = await bcrypt.hash('admin123', 10)
    
    const { error } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('email', 'admin@example.com')
      .eq('is_admin', 1)

    if (error) {
      console.error('Error updating admin password:', error)
      return
    }

    console.log('Admin password updated successfully')
  } catch (error) {
    console.error('Error during password update:', error)
  }
}

setAdminPassword() 