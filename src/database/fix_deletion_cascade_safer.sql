DO $$ 
BEGIN
    -- 1. Cascade for coupons -> billboards
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='billboard_id') THEN
        ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_billboard_id_fkey;
        ALTER TABLE public.coupons ADD CONSTRAINT coupons_billboard_id_fkey 
            FOREIGN KEY (billboard_id) REFERENCES public.billboards(id) ON DELETE CASCADE;
    END IF;

    -- 2. Cascade for favorites -> billboards
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='favorites' AND column_name='billboard_id') THEN
        ALTER TABLE public.favorites DROP CONSTRAINT IF EXISTS favorites_billboard_id_fkey;
        ALTER TABLE public.favorites ADD CONSTRAINT favorites_billboard_id_fkey 
            FOREIGN KEY (billboard_id) REFERENCES public.billboards(id) ON DELETE CASCADE;
    END IF;

    -- 3. Cascade for promos -> billboards
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promos' AND column_name='billboard_id') THEN
        ALTER TABLE public.promos DROP CONSTRAINT IF EXISTS promos_billboard_id_fkey;
        ALTER TABLE public.promos ADD CONSTRAINT promos_billboard_id_fkey 
            FOREIGN KEY (billboard_id) REFERENCES public.billboards(id) ON DELETE CASCADE;
    END IF;

    -- 4. Cascade for user_coupons -> promos
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_coupons' AND column_name='promo_id') THEN
        ALTER TABLE public.user_coupons DROP CONSTRAINT IF EXISTS user_coupons_promo_id_fkey;
        ALTER TABLE public.user_coupons ADD CONSTRAINT user_coupons_promo_id_fkey 
            FOREIGN KEY (promo_id) REFERENCES public.promos(id) ON DELETE CASCADE;
    END IF;

    -- 5. Cascade for user_coupons -> coupons
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_coupons' AND column_name='coupon_id') THEN
        ALTER TABLE public.user_coupons DROP CONSTRAINT IF EXISTS user_coupons_coupon_id_fkey;
        ALTER TABLE public.user_coupons ADD CONSTRAINT user_coupons_coupon_id_fkey 
            FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE CASCADE;
    END IF;
END $$;
