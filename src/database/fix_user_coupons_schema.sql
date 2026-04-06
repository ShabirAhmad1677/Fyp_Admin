-- Fix for missing coupon_id column in user_coupons
-- Run this in your Supabase SQL Editor

DO $$ 
BEGIN
    -- 1. Add coupon_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_coupons' AND column_name='coupon_id') THEN
        ALTER TABLE public.user_coupons ADD COLUMN coupon_id UUID REFERENCES public.coupons(id) ON DELETE CASCADE;
    END IF;

    -- 2. Add unique constraint to prevent duplicate claims (user_id + coupon_id)
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'user_coupons_coupon_id_unique'
    ) THEN
        ALTER TABLE public.user_coupons ADD CONSTRAINT user_coupons_coupon_id_unique UNIQUE (user_id, coupon_id);
    END IF;

    -- 3. Ensure promo_id is still nullable (it should be, for billboard coupons)
    ALTER TABLE public.user_coupons ALTER COLUMN promo_id DROP NOT NULL;

END $$;
