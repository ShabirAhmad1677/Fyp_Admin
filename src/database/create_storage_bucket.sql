-- Create the 'billboards' storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('billboards', 'billboards', true)
ON CONFLICT (id) DO NOTHING;

-- Set up security policies for the bucket

-- 1. Allow Public Read Access (so everyone can see the ads)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'billboards' );

-- 2. Allow Authenticated Users to Upload Images
CREATE POLICY "Authenticated Users Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'billboards'
  AND auth.role() = 'authenticated'
);

-- 3. Allow Owners to Update/Delete their own images (Optional, for stricter control)
CREATE POLICY "Users Update Own Images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'billboards'
  AND auth.uid() = owner
);

CREATE POLICY "Users Delete Own Images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'billboards'
  AND auth.uid() = owner
);
