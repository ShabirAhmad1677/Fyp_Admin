-- Add hours field to billboards table
ALTER TABLE public.billboards
ADD COLUMN IF NOT EXISTS hours TEXT;

-- Update the view to include the new hours column
DROP VIEW IF EXISTS public.billboarddataformap;
CREATE VIEW public.billboarddataformap AS
SELECT 
    id,
    id AS billboard_id,
    title,
    ARRAY[longitude, latitude] AS coords,
    image_url,
    city AS location,
    created_at,
    description,
    full_description,
    contact,
    features,
    hours
FROM public.billboards
WHERE (is_active = true);
