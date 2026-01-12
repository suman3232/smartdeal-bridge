-- Add admin SELECT policy for KYCs to allow admins to review KYC submissions
CREATE POLICY "Admins can view all KYCs"
ON public.kycs FOR SELECT
USING (public.is_admin(auth.uid()));