-- 刊登檢舉：使用者檢舉有問題的刊登，同一刊登累積達門檻時寄信通知管理員。
-- 寫入一律走 /api/report（service role，含停權/自檢舉/原因白名單檢查），
-- 一般使用者沒有 insert policy；讀取只開放「自己檢舉過的」（前端顯示已檢舉）與管理員。
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, reporter_id)
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY reports_select ON public.reports FOR SELECT
  USING (reporter_id = auth.uid() OR public.is_admin(auth.uid()));
