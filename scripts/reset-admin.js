const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://csvywizljbjpobeeadne.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzdnl3aXpsamJqcG9iZWVhZG5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjU2MzE0NSwiZXhwIjoyMDgyMTM5MTQ1fQ.cso43tJ2sUywp00QUVG1F_bIecqQGGz7wbusqBA2T3c';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetAdminPassword() {
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
    'ad3dfaef-267f-4041-a4c1-ca855a27b520',
    { password: 'password123' }
  );

  if (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  }

  console.log('Password reset successfully for admin1@test.com');
  process.exit(0);
}

resetAdminPassword();
