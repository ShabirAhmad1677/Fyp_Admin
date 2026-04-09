-- SQL Migration: Fix Billboard Active Status
-- Ensures that when a billboard is published/updated, it is marked as active so it shows up on the map.

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
    p_contact TEXT,
    p_cloud_anchor_id TEXT DEFAULT NULL,
    p_glb_asset_url TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_billboard_id UUID;
BEGIN
    -- 1. Upsert Billboard
    -- Adding is_active = true so it immediately appears on the map discovery views
    INSERT INTO public.billboards (
        id, owner_id, latitude, longitude, address, city, category, 
        image_target_url, physical_width, cloud_anchor_id, glb_asset_url, 
        is_active
    ) VALUES (
        COALESCE(p_billboard_id, gen_random_uuid()), p_owner_id, p_latitude, p_longitude, 
        p_address, p_city, p_category, p_image_target_url, p_physical_width, 
        p_cloud_anchor_id, p_glb_asset_url, 
        true
    )
    ON CONFLICT (id) DO UPDATE SET
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        address = EXCLUDED.address,
        city = EXCLUDED.city,
        category = EXCLUDED.category,
        image_target_url = EXCLUDED.image_target_url,
        physical_width = EXCLUDED.physical_width,
        cloud_anchor_id = EXCLUDED.cloud_anchor_id,
        glb_asset_url = EXCLUDED.glb_asset_url,
        is_active = true
    RETURNING id INTO v_billboard_id;

    -- 2. Upsert Campaign
    INSERT INTO public.campaigns (
        billboard_id, business_name, title, description, media_url, 
        media_type, is_active, discount, features, hours, contact
    ) VALUES (
        v_billboard_id, p_business_name, p_title, p_description, p_media_url, 
        'image', true, p_discount, p_features, p_hours, p_contact
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
