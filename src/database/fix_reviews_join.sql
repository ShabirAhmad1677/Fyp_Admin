-- Fix the foreign key for billboard_reviews to allow joins with profiles
-- This script fixes the PGRST200 error when fetching reviews

ALTER TABLE public.billboard_reviews 
DROP CONSTRAINT IF EXISTS billboard_reviews_user_id_fkey;

-- Point the foreign key directly to the profiles table
-- (Note: profiles.id should also be a FK to auth.users.id)
ALTER TABLE public.billboard_reviews 
ADD CONSTRAINT billboard_reviews_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Refresh the PostgREST cache (optional but helpful if your provider supports it)
-- NOTIFY pgrst, 'reload schema';
