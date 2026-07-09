-- 停權補洞：create_conversation 是 SECURITY DEFINER，insert 不受 conversations_insert
-- policy 檢查，停權者仍可透過 RPC 開新對話——在函式開頭補上停權檢查。
-- （messages 是前端直接 insert，messages_insert policy 已擋，不受影響）
CREATE OR REPLACE FUNCTION public.create_conversation(p_listing_id uuid, p_seller_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO public
    AS $$
declare
  v_conv_id uuid;
begin
  if is_suspended(auth.uid()) then
    raise exception '帳號停權中，無法發起對話';
  end if;

  insert into conversations (listing_id) values (p_listing_id) returning id into v_conv_id;
  insert into conversation_participants (conversation_id, user_id) values (v_conv_id, auth.uid());
  insert into conversation_participants (conversation_id, user_id) values (v_conv_id, p_seller_id);
  return v_conv_id;
end;
$$;
