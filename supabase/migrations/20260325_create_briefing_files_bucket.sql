-- Create storage bucket for briefing file uploads (logo, reference images)
-- This bucket is required by BriefingForm.tsx for image uploads

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('briefing-files', 'briefing-files', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Policy: Authenticated users can upload files
DROP POLICY IF EXISTS "Authenticated users can upload briefing files" ON storage.objects;
CREATE POLICY "Authenticated users can upload briefing files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'briefing-files');

-- 3. Policy: Public can view/download files (needed to display images)
DROP POLICY IF EXISTS "Public can view briefing files" ON storage.objects;
CREATE POLICY "Public can view briefing files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'briefing-files');

-- 4. Policy: Authenticated users can update their files
DROP POLICY IF EXISTS "Authenticated users can update briefing files" ON storage.objects;
CREATE POLICY "Authenticated users can update briefing files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'briefing-files')
WITH CHECK (bucket_id = 'briefing-files');

-- 5. Policy: Authenticated users can delete their files
DROP POLICY IF EXISTS "Authenticated users can delete briefing files" ON storage.objects;
CREATE POLICY "Authenticated users can delete briefing files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'briefing-files');
