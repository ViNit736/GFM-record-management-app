import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'gfm_record_session';

export type SessionUser = {
  id: string;
  email: string;
  prn?: string;
  role: 'student' | 'teacher' | 'admin';
  isProfileComplete: boolean;
};

// SAVE SESSION
export const saveSession = async (user: SessionUser) => {
  console.log(`💾 [SessionService] Saving session for: ${user.email} (${user.role})`);
  await AsyncStorage.setItem(
    SESSION_KEY,
    JSON.stringify(user)
  );
  // Verify it was saved
  const saved = await AsyncStorage.getItem(SESSION_KEY);
  if (!saved) console.error("❌ [SessionService] Failed to verify session save!");
};

// GET SESSION
export const getSession = async (): Promise<SessionUser | null> => {
  try {
    const data = await AsyncStorage.getItem(SESSION_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch (e) {
    console.error("❌ [SessionService] Error parsing session:", e);
    return null;
  }
};

// HELPER FOR QUICK CHECKS
export const isAuthenticated = async (): Promise<boolean> => {
  const session = await getSession();
  return !!session;
};

export const getUserRole = async (): Promise<'student' | 'teacher' | 'admin' | null> => {
  const session = await getSession();
  return session ? session.role : null;
};

export const getUserPrn = async (): Promise<string | null> => {
  const session = await getSession();
  return session ? session.prn || null : null;
};

export const isProfileComplete = async (): Promise<boolean> => {
  const session = await getSession();
  return session ? session.isProfileComplete : false;
};

// CLEAR SESSION (LOGOUT)
export const clearSession = async () => {
  await AsyncStorage.removeItem(SESSION_KEY);
};
