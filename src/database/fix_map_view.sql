-- Force update of the view to ensure all columns are present
DROP VIEW IF EXISTS public.billboarddataformap;

CREATE OR REPLACE VIEW public.billboarddataformap AS
SELECT 
    b.id,
    b.id AS billboard_id,
    b.title,
    b.image_url,
    b.city AS location,
    ARRAY[b.longitude, b.latitude] AS coords,
    b.created_at,
    b.is_active
FROM public.billboards b
WHERE b.is_active = true
  AND b.longitude IS NOT NULL 
  AND b.latitude IS NOT NULL;
