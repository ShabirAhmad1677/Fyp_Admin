-- SQL Migration: Fix Billboard Deletion Persistence
-- This script adds the missing DELETE policy and ensures linked campaigns are automatically removed.

-- 1. Add DELETE policy to Billboards table
-- Without this, deletions silently fail for standard authenticated users.
DROP POLICY IF EXISTS "Owners can delete their billboards" ON public.billboards;

CREATE POLICY "Owners can delete their billboards" 
ON public.billboards 
FOR DELETE 
TO authenticated 
USING (auth.uid() = owner_id);

-- 2. Ensure Campaigns are deleted when the Billboard is deleted (ON DELETE CASCADE)
-- This prevents "Foreign Key Violation" errors and ensures clean data removal.
ALTER TABLE public.campaigns 
DROP CONSTRAINT IF EXISTS campaigns_billboard_id_fkey;

ALTER TABLE public.campaigns
ADD CONSTRAINT campaigns_billboard_id_fkey 
FOREIGN KEY (billboard_id) 
REFERENCES public.billboards(id) 
ON DELETE CASCADE;

-- 3. Verify RLS is enabled (should already be, but good practice)
ALTER TABLE public.billboards ENABLE ROW LEVEL SECURITY;

-- 4. Note on Coupons: 
-- Based on the schema, Coupons are linked to Owners/Merchants directly. 
-- If your Coupons are linked to Campaigns/Billboards, ensure those also have ON DELETE CASCADE.
