-- Add detailed fields to billboards table
ALTER TABLE public.billboards
ADD COLUMN IF NOT EXISTS full_description TEXT,
ADD COLUMN IF NOT EXISTS contact TEXT,
ADD COLUMN IF NOT EXISTS features TEXT[]; -- Array of strings

-- Update view to include these new columns if they are not automatically included (usually * covers it, but nice to be safe)
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
    description, -- Keeping the short description if it exists
    full_description,
    contact,
    features
FROM public.billboards
WHERE (is_active = true);
