-- Migration: Add Multi-Tenancy to Coupons
-- 1. Add owner_id to track who owns the coupon
ALTER TABLE public.coupons 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- 2. Update RLS Policies
-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public can see active coupons" ON public.coupons;
DROP POLICY IF EXISTS "Owners can see all their coupons" ON public.coupons;
DROP POLICY IF EXISTS "Users can create their own coupons" ON public.coupons;
DROP POLICY IF EXISTS "Owners can update their coupons" ON public.coupons;
DROP POLICY IF EXISTS "Owners can delete their coupons" ON public.coupons;

-- Re-create Policies

-- A. PUBLIC READ: Everyone can see active coupons (assuming valid_until > now or just always visible for promo codes)
-- Adjust 'true' to fit your visibility needs. For now, let's say public can see all.
CREATE POLICY "Public can see coupons"
ON public.coupons FOR SELECT
USING (true);

-- B. OWNER INSERT: Authenticated users can create coupons
CREATE POLICY "Users can create their own coupons"
ON public.coupons FOR INSERT
WITH CHECK (
  auth.uid() = owner_id
);

-- C. OWNER UPDATE: Only owners can update their coupons
CREATE POLICY "Owners can update their coupons"
ON public.coupons FOR UPDATE
USING (auth.uid() = owner_id);

-- D. OWNER DELETE: Only owners can delete their coupons
CREATE POLICY "Owners can delete their coupons"
ON public.coupons FOR DELETE
USING (auth.uid() = owner_id);
