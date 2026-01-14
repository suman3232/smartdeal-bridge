-- Drop existing functions first
DROP FUNCTION IF EXISTS public.approve_deal(uuid);

-- Recreate approve_deal function to set status to 'open'
CREATE OR REPLACE FUNCTION public.approve_deal(deal_id uuid)
RETURNS SETOF public.deals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    admin_number TEXT;
BEGIN
    -- Get next admin number
    SELECT public.get_next_admin_number() INTO admin_number;
    
    -- Update deal status and assign admin number
    RETURN QUERY
    UPDATE public.deals
    SET 
        status = 'open',
        admin_contact_number = admin_number,
        updated_at = now()
    WHERE id = deal_id AND status = 'pending'
    RETURNING *;
END;
$$;