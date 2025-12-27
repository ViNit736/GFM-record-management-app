import { supabaseAdmin } from '../services/supabase';

async function resetAdminPassword() {
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
    'ad3dfaef-267f-4041-a4c1-ca855a27b520',
    { password: '123' }
  );

  if (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  }

  console.log('Password reset successfully for admin1@test.com');
  process.exit(0);
}

resetAdminPassword();
