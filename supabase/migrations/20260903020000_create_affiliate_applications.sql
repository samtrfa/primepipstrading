CREATE TABLE public.affiliate_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  country TEXT NOT NULL,
  website TEXT,
  instagram TEXT,
  tiktok TEXT,
  youtube TEXT,
  x_handle TEXT,
  audience_size TEXT NOT NULL,
  promotion_channels TEXT NOT NULL,
  affiliate_experience TEXT,
  promotion_plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own affiliate application"
ON public.affiliate_applications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can submit their own affiliate application"
ON public.affiliate_applications FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can review affiliate applications"
ON public.affiliate_applications FOR SELECT
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE TRIGGER update_affiliate_applications_updated_at
BEFORE UPDATE ON public.affiliate_applications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();