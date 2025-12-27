import { supabaseAdmin } from '../services/supabase';

async function fixAdmin() {
  const email = 'admin1@test.com';
  const password = '123';

  console.log(`Checking admin user: ${email}`);

  // 1. Get user by email
  const { data: { users }, error: getError } = await supabaseAdmin.auth.admin.listUsers();
  const adminUser = users.find(u => u.email === email);

  if (!adminUser) {
    console.log('Admin user not found, creating...');
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'admin', full_name: 'Admin User' }
    });
    if (createError) {
      console.error('Error creating admin:', createError);
      return;
    }
    console.log('Admin created:', createData.user.id);
  } else {
    console.log('Admin user found, updating password...');
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(adminUser.id, {
      password
    });
    if (updateError) {
      console.error('Error updating admin password:', updateError);
      return;
    }
    console.log('Admin password updated successfully');
  }
}

fixAdmin();
