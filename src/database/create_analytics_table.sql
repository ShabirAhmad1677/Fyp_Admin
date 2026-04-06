-- Create table for tracking billboard analytics (views/clicks)
CREATE TABLE IF NOT EXISTS public.billboard_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    billboard_id UUID NOT NULL REFERENCES public.billboards(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('view', 'click')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id), -- Optional: if we want to track unique users
    metadata JSONB DEFAULT '{}'::JSONB
);

-- Add RLS Policies
ALTER TABLE public.billboard_analytics ENABLE ROW LEVEL SECURITY;

-- Allow public to insert events (anyone can view/click)
CREATE POLICY "Enable insert for everyone" ON public.billboard_analytics FOR INSERT TO public WITH CHECK (true);

-- Allow owners to view their own billboard analytics
-- This requires a join with billboards table, which can be expensive for RLS. 
-- For simplicity, we might allow authenticated users to read stats, or we rely on the dashboard fetching it with service role or owner filter.
-- A more secure way for "My Ads" insights:
CREATE POLICY "Owners can view analytics for their billboards" ON public.billboard_analytics
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.billboards b
        WHERE b.id = billboard_analytics.billboard_id
        AND b.owner_id = auth.uid()
    )
);
