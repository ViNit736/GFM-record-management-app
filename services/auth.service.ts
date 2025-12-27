import { supabase, supabaseAdmin } from './supabase';
import { saveSession, clearSession, getSession } from './session.service';

export interface AuthStatus {
  isLoggedIn: boolean;
  role: 'student' | 'teacher' | 'admin' | null;
  prn: string | null;
  email: string | null;
}

export const checkLoginStatus = async (): Promise<AuthStatus> => {
  const session = await getSession();
  if (!session) {
    return {
      isLoggedIn: false,
      role: null,
      prn: null,
      email: null
    };
  }
  return {
    isLoggedIn: true,
    role: session.role,
    prn: session.prn || null,
    email: session.email
  };
};

export const login = async (identifier: string, pass: string) => {
  console.log(`🔑 [AuthService] Attempting unified login for: ${identifier}`);
  
  let email = identifier;
  
  // 1. If identifier is not an email, lookup email by PRN/Code
  if (!identifier.includes('@')) {
    const { data: lookupData, error: lookupError } = await supabase
      .rpc('lookup_email', { identifier });
    
    if (lookupError) {
      console.error('Lookup error:', lookupError);
      throw new Error("Invalid PRN or Code");
    }
    
    if (!lookupData || lookupData.length === 0) {
      throw new Error("User not found");
    }
    
    email = lookupData[0].email;
  }

  // 2. Login with email and password
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass
  });

  if (error) throw error;
  if (!data.user) throw new Error("No user found");

  // 3. Fetch profile to get role and details
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profileError) throw profileError;

  await saveSession({
    id: data.user.id,
    email: data.user.email!,
    role: profile.role,
    prn: profile.prn,
    isProfileComplete: true 
  });

  return { id: data.user.id, email: data.user.email, role: profile.role, prn: profile.prn };
};

export const loginWithEmail = async (email: string, pass: string) => {
  return login(email, pass);
};

export const loginWithCode = async (email: string, code: string, role: 'teacher' | 'admin') => {
  console.log(`🔑 [AuthService] Attempting login with ${role} code for email: ${email}`);
  
  const { data: profile, error: lookupError } = await supabase
    .from('profiles')
    .select('id, role, teacher_code, admin_code')
    .eq('email', email)
    .single();

  if (lookupError || !profile) throw new Error("User not found");
  if (profile.role !== role) throw new Error(`User is not an ${role}`);
  
  const storedCode = role === 'teacher' ? profile.teacher_code : profile.admin_code;
  if (storedCode !== code) throw new Error("Invalid code");

  return loginWithEmail(email, code); 
};

export const adminCreateUser = async (email: string, prn: string | null, role: 'student' | 'teacher', code: string | null, fullName: string) => {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: code || 'GFMRecord@123', 
    email_confirm: true,
    user_metadata: { role, full_name: fullName }
  });

  if (error) throw error;

  const { error: profileError } = await supabase.from('profiles').insert({
    id: data.user.id,
    email,
    prn,
    role,
    teacher_code: role === 'teacher' ? code : null,
    full_name: fullName
  });

  if (profileError) throw profileError;
  return data.user;
};

export const loginWithPRN = async (prn: string, pass: string) => {
  console.log(`🔑 [AuthService] Attempting login for PRN: ${prn}`);
  
  // 1. Find email for this PRN
  const { data: profile, error: lookupError } = await supabase
    .from('profiles')
    .select('email')
    .eq('prn', prn)
    .single();

  if (lookupError || !profile) {
    throw new Error("Invalid PRN");
  }

  // 2. Login with email and password
  return loginWithEmail(profile.email, pass);
};

export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'gfmrecord://reset-password',
  });
  if (error) throw error;
};

export const logout = async () => {
  await supabase.auth.signOut();
  await clearSession();
};

export const markProfileComplete = async (userId: string) => {
  // Update your profiles table if needed
  const session = await getSession();
  if (session && session.id === userId) {
    session.isProfileComplete = true;
    await saveSession(session);
  }
};
