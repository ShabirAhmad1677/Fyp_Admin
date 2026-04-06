-- Update billboarddataformap view to include all columns needed by the app
-- This fixes the issue where views show as 0 and business name is empty

DROP VIEW IF EXISTS public.billboarddataformap;

CREATE VIEW public.billboarddataformap AS
SELECT 
    b.id,
    b.id AS billboard_id,
    b.title,
    b.business,
    b.category,
    b.views,
    b.latitude,
    b.longitude,
    ARRAY[b.longitude, b.latitude] AS coords,
    b.image_url,
    b.city AS location,
    b.created_at,
    b.description,
    b.full_description,
    b.contact,
    b.features,
    b.hours,
    b.discount,
    b.is_active,
    b.owner_id,
    b.marker_id,
    COALESCE(AVG(r.rating), 0) as avg_rating,
    COUNT(r.id) as review_count
FROM public.billboards b
LEFT JOIN public.billboard_reviews r ON b.id = r.billboard_id
-- We include all to allow the app to filter if needed, 
-- but traditionally this view is for active ones
-- WHERE (b.is_active = true) 
GROUP BY b.id;
