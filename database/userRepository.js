const supabase = require("../config/supabase")

// Functie om alle gebruikers op te halen met profielgegevens
async function getAllUsers() {
  try {
    console.log("userRepository: getAllUsers aangeroepen")

    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id, 
        email, 
        company_name,
        first_name,
        last_name,
        phone,
        created_at,
        last_login,
        balance,
        payment_method,
        is_admin,
        has_payment_method
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    console.log(`userRepository: ${users ? users.length : 0} gebruikers opgehaald`)

    // Debug de eerste gebruiker
    if (users && users.length > 0) {
      console.log("Eerste gebruiker:", JSON.stringify(users[0], null, 2))
    }

    return users || []
  } catch (error) {
    console.error("userRepository: Fout bij ophalen gebruikers:", error)
    throw error
  }
}

// Functie om een specifieke gebruiker op te halen
async function getUserById(userId) {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id, 
        email, 
        created_at,
        last_login,
        company_name,
        first_name,
        last_name,
        phone,
        is_admin,
        status,
        balance,
        payment_method
      `)
      .eq('id', userId)
      .single()

    if (error) throw error
    return user
  } catch (error) {
    console.error("Fout bij ophalen gebruiker:", error)
    throw error
  }
}

// Functie om een gebruiker bij te werken
async function updateUser(userId, userData) {
  try {
    // Validate required fields
    if (!userData.email || !userData.company_name) {
      throw new Error("Email and company name are required");
    }

    // Check if email already exists for another user
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', userData.email)
      .neq('id', userId)
      .single();

    if (existingUser) {
      throw new Error("Email is already in use by another user");
    }

    // Prepare update data
    const updateData = {
      email: userData.email,
      company_name: userData.company_name,
      first_name: userData.first_name || null,
      last_name: userData.last_name || null,
      phone: userData.phone || null,
      is_admin: typeof userData.is_admin !== 'undefined' ? userData.is_admin : undefined,
      status: userData.status || undefined
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error("User not found");
    }

    return {
      success: true,
      message: "User updated successfully",
      data: data[0]
    };
  } catch (error) {
    console.error("Error updating user:", error);
    throw {
      success: false,
      message: error.message || "An error occurred while updating the user",
      error: error
    };
  }
}

// Functie om een nieuwe gebruiker toe te voegen
async function createUser(userData) {
  try {
    const { data, error } = await supabase
      .from('users')
      .insert([{
        email: userData.email,
        company_name: userData.company_name,
        first_name: userData.first_name || null,
        last_name: userData.last_name || null,
        phone: userData.phone || null,
        is_admin: userData.is_admin || 0,
        status: userData.status || "active",
        created_at: new Date().toISOString()
      }])
      .select()

    if (error) throw error

    return {
      success: true,
      message: "Gebruiker aangemaakt",
      userId: data[0].id
    }
  } catch (error) {
    console.error("Fout bij aanmaken gebruiker:", error)
    throw error
  }
}

// Functie om een gebruiker te verwijderen
async function deleteUser(userId) {
  try {
    console.log(`deleteUser aangeroepen voor ID: ${userId}`)

    // Verwijder eerst gerelateerde gegevens
    // Verwijder gerelateerde payments
    const { error: paymentsError } = await supabase
      .from('payments')
      .delete()
      .eq('user_id', userId)

    if (paymentsError) throw paymentsError
    console.log(`Payments verwijderd voor gebruiker ${userId}`)

    // Verwijder gerelateerde leads
    const { error: leadsError } = await supabase
      .from('leads')
      .delete()
      .eq('user_id', userId)

    if (leadsError) throw leadsError
    console.log(`Leads verwijderd voor gebruiker ${userId}`)

    // Verwijder de gebruiker
    const { error: userError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (userError) throw userError
    console.log(`Gebruiker ${userId} verwijderd`)

    return { success: true, message: "Gebruiker verwijderd" }
  } catch (error) {
    console.error("Fout bij verwijderen gebruiker:", error.stack || error)
    throw error
  }
}

// Functie om gebruikersstatus bij te werken
async function updateUserStatus(userId, status) {
  try {
    console.log(`updateUserStatus aangeroepen met userId: ${userId}, status: ${status}`);

    const { data, error } = await supabase
      .from('users')
      .update({ status })
      .eq('id', userId)
      .select();

    if (error) {
      console.error("Supabase error bij updateUserStatus:", error);
      throw error;
    }

    console.log("Supabase update succesvol:", data);

    return { 
      success: true, 
      message: "Gebruiker succesvol bewerkt",
      data 
    };
  } catch (error) {
    console.error("Fout bij bijwerken gebruikersstatus:", error);
    throw error;
  }
}

// Functie om gebruikersrol bij te werken
async function updateUserRole(userId, isAdmin) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ is_admin: isAdmin })
      .eq('id', userId)

    if (error) throw error

    return { success: true, message: "Gebruikersrol bijgewerkt" }
  } catch (error) {
    console.error("Fout bij bijwerken gebruikersrol:", error)
    throw error
  }
}

// Functie om meerdere gebruikers te verwijderen
async function deleteMultipleUsers(userIds) {
  try {
    // Verwijder eerst gerelateerde gegevens
    // Verwijder gerelateerde payments
    const { error: paymentsError } = await supabase
      .from('payments')
      .delete()
      .in('user_id', userIds)

    if (paymentsError) throw paymentsError

    // Verwijder gerelateerde leads
    const { error: leadsError } = await supabase
      .from('leads')
      .delete()
      .in('user_id', userIds)

    if (leadsError) throw leadsError

    // Verwijder de gebruikers
    const { error: usersError } = await supabase
      .from('users')
      .delete()
      .in('id', userIds)

    if (usersError) throw usersError

    return { success: true, message: "Gebruikers verwijderd" }
  } catch (error) {
    console.error("Fout bij verwijderen gebruikers:", error)
    throw error
  }
}

// Functie om status van meerdere gebruikers bij te werken
async function updateMultipleUserStatus(userIds, status) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ status })
      .in('id', userIds)

    if (error) throw error

    return { success: true, message: "Gebruikersstatus bijgewerkt" }
  } catch (error) {
    console.error("Fout bij bijwerken gebruikersstatus:", error)
    throw error
  }
}

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  createUser,
  deleteUser,
  updateUserStatus,
  updateUserRole,
  deleteMultipleUsers,
  updateMultipleUserStatus
}
