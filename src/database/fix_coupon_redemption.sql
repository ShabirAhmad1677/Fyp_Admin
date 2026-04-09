-- SQL Migration: Fix Coupon Redemption Logic
-- Enables UUID or ShortCode lookup and returns full merchant details for verification

CREATE OR REPLACE FUNCTION public.redeem_coupon(p_code TEXT)
RETURNS JSON AS $$
DECLARE
  v_offer RECORD;
  v_details JSON;
BEGIN
  -- 1. Search for the coupon by Short Code (Case-Insensitive) OR UUID
  SELECT 
    s.id, s.is_redeemed, s.campaign_id,
    c.title, c.business_name, c.discount
  INTO v_offer
  FROM public.saved_offers s
  JOIN public.campaigns c ON c.id = s.campaign_id
  WHERE (upper(s.redemption_code) = upper(p_code) OR s.id::text = p_code)
  LIMIT 1;

  -- 2. Handle invalid code
  IF v_offer.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid Coupon. Please check the code and try again.');
  END IF;

  -- 3. Handle already redeemed
  IF v_offer.is_redeemed THEN
    RETURN json_build_object('success', false, 'error', 'This coupon has already been used.');
  END IF;

  -- 4. Mark as redeemed
  UPDATE public.saved_offers 
  SET is_redeemed = TRUE, redeemed_at = NOW() 
  WHERE id = v_offer.id;

  -- 5. Build response details
  v_details := json_build_object(
    'title', v_offer.title,
    'business', v_offer.business_name,
    'discount', v_offer.discount
  );

  RETURN json_build_object(
    'success', true, 
    'message', 'Coupon verified and redeemed!',
    'offer_details', v_details
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
