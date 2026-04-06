-- UNIFIED ECOSYSTEM MIGRATION (FINAL CONSOLIDATED)
-- This script synchronizes the Expo App and the Admin Dashboard.
-- RUN THIS IN SUPABASE SQL EDITOR

-- 0. PROFILES (CEO P3: User Data Asset)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    interests TEXT[] DEFAULT '{}', -- P3: Shoes, Tech, Food, etc.
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- BACKFILL EXISTING USERS (CEO Fix: Ensure all historical users have profiles)
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT id, raw_user_meta_data->>'full_name', raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 1. BILLBOARD SCHEMA UPGRADE (For AR & Ownership)
ALTER TABLE public.billboards 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id), -- Critical Fix: Link to merchant
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General', -- P3 targeting
ADD COLUMN IF NOT EXISTS image_target_url TEXT, -- AR physical board image
ADD COLUMN IF NOT EXISTS physical_width FLOAT DEFAULT 1.0; -- AR calibration

-- 1.1 CAMPAIGN SCHEMA UPGRADE (For Commerce Data)
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS discount TEXT,
ADD COLUMN IF NOT EXISTS features TEXT[],
ADD COLUMN IF NOT EXISTS hours TEXT,
ADD COLUMN IF NOT EXISTS contact TEXT;

-- 1.2 THE "CLEAN SLATE" UTILITY (DANGEROUS: RUN ONLY TO WIPE DEMO DATA)
-- This deletes billboards and campaigns that don't have an owner (legacy data)
-- To run, uncomment the lines below:
-- DELETE FROM public.billboards WHERE owner_id IS NULL;
-- DELETE FROM public.campaigns WHERE billboard_id NOT IN (SELECT id FROM public.billboards);

-- 2. ANALYTICS CONSOLIDATION
DROP TABLE IF EXISTS public.billboard_analytics CASCADE; -- Clean up old dashboard table

CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    billboard_id UUID REFERENCES public.billboards(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id),
    event_type TEXT NOT NULL CHECK (event_type IN ('proximity', 'map_view', 'scan', 'tap', 'save')),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::JSONB
);

-- 3. SAVED OFFERS (Wallet)
CREATE TABLE IF NOT EXISTS public.saved_offers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    redemption_code TEXT DEFAULT upper(substring(md5(random()::text) from 1 for 6)),
    is_redeemed BOOLEAN DEFAULT FALSE,
    redeemed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, campaign_id)
);

-- PATCH: Ensure columns exist if table was created earlier
ALTER TABLE public.saved_offers 
ADD COLUMN IF NOT EXISTS redemption_code TEXT DEFAULT upper(substring(md5(random()::text) from 1 for 6)),
ADD COLUMN IF NOT EXISTS is_redeemed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMPTZ;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_offers ENABLE ROW LEVEL SECURITY;

-- Profile Policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Billboards Policies
DROP POLICY IF EXISTS "Public can view billboards" ON public.billboards;
CREATE POLICY "Public can view billboards" ON public.billboards FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Merchants can insert billboards" ON public.billboards;
CREATE POLICY "Merchants can insert billboards" ON public.billboards FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Owners can update their billboards" ON public.billboards;
CREATE POLICY "Owners can update their billboards" ON public.billboards FOR UPDATE TO authenticated USING (auth.uid() = owner_id);

-- Campaigns Policies
DROP POLICY IF EXISTS "Public can view campaigns" ON public.campaigns;
CREATE POLICY "Public can view campaigns" ON public.campaigns FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Merchants can manage their campaigns" ON public.campaigns;
CREATE POLICY "Merchants can manage their campaigns" ON public.campaigns FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.billboards WHERE id = campaigns.billboard_id AND owner_id = auth.uid()));

-- Analytics Policies
DROP POLICY IF EXISTS "Public can log events" ON public.analytics_events;
CREATE POLICY "Public can log events" ON public.analytics_events FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can view their billboard analytics" ON public.analytics_events;
CREATE POLICY "Admins can view their billboard analytics" ON public.analytics_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.billboards b WHERE b.id = analytics_events.billboard_id AND b.owner_id = auth.uid()));

-- Saves Policies
DROP POLICY IF EXISTS "Users can manage their own saves" ON public.saved_offers;
CREATE POLICY "Users can manage their own saves" ON public.saved_offers FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 5. VIEWS FOR DASHBOARD & REVENUE PROOF
DROP VIEW IF EXISTS public.merchant_roi;
CREATE VIEW public.merchant_roi AS
SELECT 
    c.business_name,
    COUNT(DISTINCT a.id) as total_scans,
    COUNT(DISTINCT s.id) as total_saves,
    COUNT(DISTINCT CASE WHEN s.is_redeemed THEN s.id END) as total_redemptions,
    CASE WHEN COUNT(DISTINCT a.id) > 0 
        THEN (COUNT(DISTINCT s.id)::float / COUNT(DISTINCT a.id)::float) * 100 
        ELSE 0 END as save_rate
FROM public.campaigns c
LEFT JOIN public.analytics_events a ON a.campaign_id = c.id AND a.event_type = 'scan'
LEFT JOIN public.saved_offers s ON s.campaign_id = c.id
GROUP BY c.business_name;

DROP VIEW IF EXISTS public.merchant_insights;
CREATE VIEW public.merchant_insights AS
SELECT 
    billboard_id,
    event_type,
    COUNT(*) as event_count,
    DATE_TRUNC('day', created_at) as event_date
FROM public.analytics_events
GROUP BY billboard_id, event_type, event_date;

-- 6. ATOMIC TRANSACTIONS (Senior P0: Data Integrity)
-- Ensures billboard and campaign are saved together or not at all.

-- First, ensure only one active campaign per billboard for easy upsert
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_campaign 
ON public.campaigns (billboard_id) 
WHERE (is_active = true);

CREATE OR REPLACE FUNCTION public.publish_billboard_with_campaign(
    p_billboard_id UUID,
    p_owner_id UUID,
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_address TEXT,
    p_city TEXT,
    p_category TEXT,
    p_image_target_url TEXT,
    p_physical_width FLOAT,
    p_business_name TEXT,
    p_title TEXT,
    p_description TEXT,
    p_media_url TEXT,
    p_discount TEXT,
    p_features TEXT[],
    p_hours TEXT,
    p_contact TEXT
) RETURNS UUID AS $$
DECLARE
    v_billboard_id UUID;
BEGIN
    -- 1. Upsert Billboard
    INSERT INTO public.billboards (
        id, owner_id, latitude, longitude, address, city, category, image_target_url, physical_width
    ) VALUES (
        COALESCE(p_billboard_id, gen_random_uuid()), p_owner_id, p_latitude, p_longitude, p_address, p_city, p_category, p_image_target_url, p_physical_width
    )
    ON CONFLICT (id) DO UPDATE SET
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        address = EXCLUDED.address,
        city = EXCLUDED.city,
        category = EXCLUDED.category,
        image_target_url = EXCLUDED.image_target_url,
        physical_width = EXCLUDED.physical_width
    RETURNING id INTO v_billboard_id;

    -- 2. Upsert Campaign
    INSERT INTO public.campaigns (
        billboard_id, business_name, title, description, media_url, media_type, is_active, discount, features, hours, contact
    ) VALUES (
        v_billboard_id, p_business_name, p_title, p_description, p_media_url, 'image', true, p_discount, p_features, p_hours, p_contact
    )
    ON CONFLICT (billboard_id) WHERE is_active = true DO UPDATE SET
        business_name = EXCLUDED.business_name,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        media_url = EXCLUDED.media_url,
        discount = EXCLUDED.discount,
        features = EXCLUDED.features,
        hours = EXCLUDED.hours,
        contact = EXCLUDED.contact;

    RETURN v_billboard_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
