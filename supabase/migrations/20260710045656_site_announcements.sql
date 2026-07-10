-- 全站置頂公告：站長發佈新功能或全站訊息，前台橫幅顯示最新一則啟用中的公告
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  link_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 所有人（含未登入）都能讀啟用中的公告
CREATE POLICY "Active announcements are viewable by everyone"
  ON public.announcements FOR SELECT
  USING (is_active = true);

-- 只有管理員能新增／修改／刪除
CREATE POLICY "Admins can manage announcements"
  ON public.announcements FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
