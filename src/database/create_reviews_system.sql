-- Create billboard_reviews table
CREATE TABLE IF NOT EXISTS public.billboard_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    billboard_id UUID REFERENCES public.billboards(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(billboard_id, user_id) -- One review per user per billboard
);

-- Enable RLS
ALTER TABLE public.billboard_reviews ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view reviews" 
ON public.billboard_reviews FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can submit reviews" 
ON public.billboard_reviews FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews" 
ON public.billboard_reviews FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews" 
ON public.billboard_reviews FOR DELETE 
USING (auth.uid() = user_id);

-- Update billboarddataformap view to include average rating (optional but helpful)
-- Note: This is a simplified version, real-world might use a trigger or a more complex query
DROP VIEW IF EXISTS public.billboarddataformap;
CREATE VIEW public.billboarddataformap AS
SELECT 
    b.id,
    b.id AS billboard_id,
    b.title,
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
    COALESCE(AVG(r.rating), 0) as avg_rating,
    COUNT(r.id) as review_count
FROM public.billboards b
LEFT JOIN public.billboard_reviews r ON b.id = r.billboard_id
WHERE (b.is_active = true)
GROUP BY b.id;
