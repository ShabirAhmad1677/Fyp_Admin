-- FINAL UNIFIED RPC: fix_rpc_ambiguity.sql
-- Resolves "Could not choose the best candidate function" and adds dynamic Website URL support.

-- 1. SCHEMA REINFORCEMENT (Ensure all columns exist in billboards)
ALTER TABLE public.billboards 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS cloud_anchor_id TEXT,
ADD COLUMN IF NOT EXISTS glb_asset_url TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. SCHEMA REINFORCEMENT (Ensure all columns exist in campaigns)
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS website_url TEXT,
ADD COLUMN IF NOT EXISTS glb_asset_url TEXT,
ADD COLUMN IF NOT EXISTS business_logo_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. DROP ALL POTENTIAL OVERLOADS (To prevent ambiguity)
DROP FUNCTION IF EXISTS public.publish_billboard_with_campaign(uuid, uuid, double precision, double precision, text, text, text, text, double precision, text, text, text, text, text, text[], text, text, text, text);
DROP FUNCTION IF EXISTS public.publish_billboard_with_campaign(uuid, uuid, double precision, double precision, text, text, text, text, double precision, text, text, text, text, text, text[], text, text);
DROP FUNCTION IF EXISTS public.publish_billboard_with_campaign(uuid, uuid, double precision, double precision, text, text, text, text, float, text, text, text, text, text, text[], text, text);

-- 4. CREATE MASTER UNIFIED FUNCTION
CREATE OR REPLACE FUNCTION public.publish_billboard_with_campaign(
    p_billboard_id      UUID DEFAULT NULL,
    p_owner_id          UUID DEFAULT auth.uid(),
    p_latitude          DOUBLE PRECISION DEFAULT NULL,
    p_longitude         DOUBLE PRECISION DEFAULT NULL,
    p_address           TEXT DEFAULT NULL,
    p_city              TEXT DEFAULT NULL,
    p_category          TEXT DEFAULT 'General',
    p_image_target_url  TEXT DEFAULT NULL,
    p_physical_width    DOUBLE PRECISION DEFAULT 1.0,
    -- AR / SPATIAL FIELDS
    p_cloud_anchor_id   TEXT DEFAULT NULL,
    p_glb_asset_url     TEXT DEFAULT NULL,
    -- CAMPAIGN FIELDS
    p_business_name      TEXT DEFAULT 'New Business',
    p_business_logo_url  TEXT DEFAULT NULL,
    p_title              TEXT DEFAULT 'New Offer',
    p_description        TEXT DEFAULT NULL,
    p_media_url          TEXT DEFAULT NULL,
    p_media_type         TEXT DEFAULT 'image',
    p_discount           TEXT DEFAULT NULL,
    p_features           TEXT[] DEFAULT '{}',
    p_hours              TEXT DEFAULT NULL,
    p_contact            TEXT DEFAULT NULL,
    p_website_url        TEXT DEFAULT NULL
) 
RETURNS UUID AS $$
DECLARE
    v_billboard_id UUID;
BEGIN
    -- 1. Create or Update Billboard
    INSERT INTO public.billboards (
        id, owner_id, latitude, longitude, address, city, category, 
        image_target_url, physical_width, cloud_anchor_id, glb_asset_url,
        is_active
    ) VALUES (
        COALESCE(p_billboard_id, gen_random_uuid()), 
        p_owner_id, 
        p_latitude, 
        p_longitude, 
        p_address, 
        p_city, 
        p_category, 
        p_image_target_url, 
        p_physical_width, 
        p_cloud_anchor_id, 
        p_glb_asset_url,
        true
    )
    ON CONFLICT (id) DO UPDATE SET
        latitude = COALESCE(p_latitude, billboards.latitude),
        longitude = COALESCE(p_longitude, billboards.longitude),
        address = COALESCE(NULLIF(p_address, ''), billboards.address),
        city = COALESCE(NULLIF(p_city, ''), billboards.city),
        category = COALESCE(NULLIF(p_category, ''), billboards.category),
        image_target_url = COALESCE(NULLIF(p_image_target_url, ''), billboards.image_target_url),
        physical_width = COALESCE(p_physical_width, billboards.physical_width),
        cloud_anchor_id = COALESCE(NULLIF(p_cloud_anchor_id, ''), billboards.cloud_anchor_id),
        glb_asset_url = COALESCE(NULLIF(p_glb_asset_url, ''), billboards.glb_asset_url),
        is_active = true,
        updated_at = NOW()
    RETURNING id INTO v_billboard_id;

    -- 2. Handle Campaign (Upsert active campaign for this billboard)
    INSERT INTO public.campaigns (
        billboard_id, business_name, business_logo_url, title, description, 
        media_url, media_type, is_active, discount, features, hours, 
        contact, website_url, glb_asset_url
    ) 
    VALUES (
        v_billboard_id, p_business_name, p_business_logo_url, p_title, p_description, 
        p_media_url, p_media_type, true, p_discount, p_features, p_hours, 
        p_contact, p_website_url, p_glb_asset_url
    )
    ON CONFLICT (billboard_id) WHERE is_active = true 
    DO UPDATE SET
        business_name = COALESCE(NULLIF(p_business_name, ''), campaigns.business_name),
        business_logo_url = COALESCE(NULLIF(p_business_logo_url, ''), campaigns.business_logo_url),
        title = COALESCE(NULLIF(p_title, ''), campaigns.title),
        description = COALESCE(NULLIF(p_description, ''), campaigns.description),
        media_url = COALESCE(NULLIF(p_media_url, ''), campaigns.media_url),
        media_type = COALESCE(NULLIF(p_media_type, ''), campaigns.media_type),
        discount = COALESCE(NULLIF(p_discount, ''), campaigns.discount),
        features = COALESCE(p_features, campaigns.features),
        hours = COALESCE(NULLIF(p_hours, ''), campaigns.hours),
        contact = COALESCE(NULLIF(p_contact, ''), campaigns.contact),
        website_url = COALESCE(NULLIF(p_website_url, ''), campaigns.website_url),
        glb_asset_url = COALESCE(NULLIF(p_glb_asset_url, ''), campaigns.glb_asset_url),
        updated_at = NOW();

    RETURN v_billboard_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
