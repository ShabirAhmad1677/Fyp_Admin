-- FIX: Billboard Foreign Key Constraint Violation
-- This script migrates the owner_id reference from the profiles table to the authenticated users table.
-- This ensures that billboard creation doesn't fail if a profile entry is missing.

-- 1. DROP THE OLD PROFILE-BASED CONSTRAINT
-- Finding and dropping the constraint that references public.profiles(id)
ALTER TABLE public.billboards DROP CONSTRAINT IF EXISTS billboards_owner_id_fkey;

-- 2. ADD NEW ROBUST CONSTRAINT
-- We reference auth.users(id) directly. This is safer for ownership logic.
ALTER TABLE public.billboards 
ADD CONSTRAINT billboards_owner_id_fkey 
FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. SAFETY PROFILE BACKFILL
-- Ensure all existing users have a corresponding profile record.
-- This fixes the root cause for any other features that might depend on public.profiles.
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT id, raw_user_meta_data->>'full_name', raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 4. RE-GENERATE RPC TO ENSURE SECURITY DEFINER USES LATEST SCHEMA
-- (Optional but recommended to flush cached query plans)
-- No changes needed to the RPC code itself, just ensuring the constraint is enforced.
