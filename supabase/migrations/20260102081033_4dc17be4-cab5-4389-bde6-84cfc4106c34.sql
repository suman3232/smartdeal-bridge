-- Create storage bucket for order screenshots
INSERT INTO storage.buckets (id, name, public) 
VALUES ('order-screenshots', 'order-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policy for order screenshots - users can upload their own
CREATE POLICY "Users can upload order screenshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'order-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS policy - users can view screenshots for their orders
CREATE POLICY "Users can view order screenshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'order-screenshots');

-- RLS policy - users can update their own screenshots
CREATE POLICY "Users can update their order screenshots"
ON storage.objects FOR UPDATE
USING (bucket_id = 'order-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS policy - users can delete their own screenshots
CREATE POLICY "Users can delete their order screenshots"
ON storage.objects FOR DELETE
USING (bucket_id = 'order-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);