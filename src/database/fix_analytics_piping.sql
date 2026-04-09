-- SQL Migration: Fix Analytics Data Piping & Permissions
-- 1. Add billboard_id to saved_offers for better dashboard filtering
-- 2. Unlock RLS for Merchants to see their own data

-- Step 1: Add billboard_id column to saved_offers
ALTER TABLE public.saved_offers 
ADD COLUMN IF NOT EXISTS billboard_id UUID REFERENCES public.billboards(id) ON DELETE CASCADE;

-- Step 2: RLS Policy for Merchants to see Analytics
-- This allows the billboard owner (Merchant) to see events logged for their boards
DROP POLICY IF EXISTS "Merchants can see own analytics" ON public.analytics_events;
CREATE POLICY "Merchants can see own analytics" 
ON public.analytics_events FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.billboards 
    WHERE public.billboards.id = public.analytics_events.billboard_id 
    AND public.billboards.owner_id = auth.uid()
  )
);

-- Step 3: RLS Policy for Merchants to see Saved Offers
-- This allows the billboard owner (Merchant) to see coupons saved for their boards
DROP POLICY IF EXISTS "Merchants can see own saved offers" ON public.saved_offers;
CREATE POLICY "Merchants can see own saved offers" 
ON public.saved_offers FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.billboards 
    WHERE public.billboards.id = public.saved_offers.billboard_id 
    AND public.billboards.owner_id = auth.uid()
  )
);
