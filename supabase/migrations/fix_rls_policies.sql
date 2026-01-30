-- Fix RLS policies for attendance_follow_ups and pre_informed_absences tables
-- Execute this in Supabase SQL Editor

-- ============================================
-- ATTENDANCE FOLLOW-UPS TABLE POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "attendance_follow_ups_select_policy" ON attendance_follow_ups;
DROP POLICY IF EXISTS "attendance_follow_ups_insert_policy" ON attendance_follow_ups;
DROP POLICY IF EXISTS "attendance_follow_ups_update_policy" ON attendance_follow_ups;

-- Allow teachers and admins to SELECT their own follow-ups
CREATE POLICY "attendance_follow_ups_select_policy" 
ON attendance_follow_ups FOR SELECT 
USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE role IN ('teacher', 'admin')
  )
);

-- Allow teachers and admins to INSERT follow-ups
CREATE POLICY "attendance_follow_ups_insert_policy" 
ON attendance_follow_ups FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE role IN ('teacher', 'admin')
  )
);

-- Allow teachers and admins to UPDATE their own follow-ups
CREATE POLICY "attendance_follow_ups_update_policy" 
ON attendance_follow_ups FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE role IN ('teacher', 'admin')
  )
);

-- ============================================
-- PRE-INFORMED ABSENCES TABLE POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "pre_informed_absences_select_policy" ON pre_informed_absences;
DROP POLICY IF EXISTS "pre_informed_absences_insert_policy" ON pre_informed_absences;
DROP POLICY IF EXISTS "pre_informed_absences_update_policy" ON pre_informed_absences;

-- Allow teachers and admins to SELECT pre-informed absences
CREATE POLICY "pre_informed_absences_select_policy" 
ON pre_informed_absences FOR SELECT 
USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE role IN ('teacher', 'admin')
  )
);

-- Allow teachers and admins to INSERT pre-informed absences
CREATE POLICY "pre_informed_absences_insert_policy"
ON pre_informed_absences FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles
    WHERE role IN ('teacher', 'admin')
  )
);

-- Allow teachers and admins to UPDATE pre-informed absences
CREATE POLICY "pre_informed_absences_update_policy"
ON pre_informed_absences FOR UPDATE
USING (
  auth.uid() IN (
    SELECT id FROM profiles
    WHERE role IN ('teacher', 'admin')
  )
);

-- Verify RLS is enabled
ALTER TABLE attendance_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_informed_absences ENABLE ROW LEVEL SECURITY;
