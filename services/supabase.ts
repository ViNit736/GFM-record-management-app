import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://csvywizljbjpobeeadne.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzdnl3aXpsamJqcG9iZWVhZG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NjMxNDUsImV4cCI6MjA4MjEzOTE0NX0.TJ2QUeXpuokfjT6XcsD5L2SbSQY1Zn3mm9VWb92P1H4';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzdnl3aXpsamJqcG9iZWVhZG5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjU2MzE0NSwiZXhwIjoyMDgyMTM5MTQ1fQ.cso43tJ2sUywp00QUVG1F_bIecqQGGz7wbusqBA2T3c';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Separate client for admin operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export const uploadToSupabase = async (uri: string, bucket: string) => {
  try {
    const fileName = uri.split('/').pop() || `${Date.now()}.jpg`;
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: fileName,
      type: 'image/jpeg',
    } as any);

    const fileExt = fileName.split('.').pop();
    const filePath = `${Date.now()}.${fileExt}`;

    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, arrayBuffer, {
        contentType: 'image/jpeg',
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    throw error;
  }
};
