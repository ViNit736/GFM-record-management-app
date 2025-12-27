import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://csvywizljbjpobeeadne.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzdnl3aXpsamJqcG9iZWVhZG5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjU2MzE0NSwiZXhwIjoyMDgyMTM5MTQ1fQ.cso43tJ2sUywp00QUVG1F_bIecqQGGz7wbusqBA2T3c';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setup() {
  console.log('🚀 Creating admin user...');
  
  const email = 'admin1@test.com';
  const password = '123';
  
  // 1. Create user in auth
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'admin', full_name: 'Admin User' }
  });

  if (userError) {
    if (userError.message.includes('already registered')) {
      console.log('✅ Admin user already exists in Auth');
      // Try to find the user
      const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;
      const existingUser = users.users.find(u => u.email === email);
      if (existingUser) {
        await createProfile(existingUser.id, email);
      }
    } else {
      console.error('❌ Error creating user:', userError);
    }
  } else {
    console.log('✅ Admin user created in Auth:', userData.user.id);
    await createProfile(userData.user.id, email);
  }
}

async function createProfile(id: string, email: string) {
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id,
      email,
      role: 'admin',
      admin_code: 'admin1',
      full_name: 'Admin User'
    });

  if (profileError) {
    console.error('❌ Error creating profile:', profileError);
  } else {
    console.log('✅ Admin profile created/updated');
  }
}

setup().catch(console.error);
