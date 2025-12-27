const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://csvywizljbjpobeeadne.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzdnl3aXpsamJqcG9iZWVhZG5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjU2MzE0NSwiZXhwIjoyMDgyMTM5MTQ1fQ.cso43tJ2sUywp00QUVG1F_bIecqQGGz7wbusqBA2T3c';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixAdmin() {
  const email = 'admin1@test.com';
  const password = 'password123';
  const adminCode = 'admin1';

  console.log(`Checking admin user: ${email}`);

  // 1. Get user by email
  const { data: { users }, error: getError } = await supabaseAdmin.auth.admin.listUsers();
  let adminUser = users.find(u => u.email === email);

  if (!adminUser) {
    console.log('Admin user not found, creating in auth...');
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'admin', full_name: 'Admin User' }
    });
    if (createError) {
      console.error('Error creating admin in auth:', createError);
      return;
    }
    adminUser = createData.user;
    console.log('Admin created in auth:', adminUser.id);
  } else {
    console.log('Admin user found, updating password...');
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(adminUser.id, {
      password
    });
    if (updateError) {
      console.error('Error updating admin password:', updateError);
    } else {
      console.log('Admin password updated successfully');
    }
  }

  // 2. Ensure profile exists and has correct admin_code
  console.log('Checking profile...');
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();

  if (!profile) {
    console.log('Profile not found, creating...');
    const { error: insertError } = await supabaseAdmin.from('profiles').insert({
      id: adminUser.id,
      email,
      role: 'admin',
      admin_code: adminCode,
      full_name: 'Admin User'
    });
    if (insertError) console.error('Error creating profile:', insertError);
    else console.log('Profile created successfully');
  } else {
    console.log('Profile found, updating admin_code...');
    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update({ admin_code: adminCode, role: 'admin' })
      .eq('id', profile.id);
    if (updateProfileError) console.error('Error updating profile:', updateProfileError);
    else console.log('Profile updated successfully');
  }
}

fixAdmin();
