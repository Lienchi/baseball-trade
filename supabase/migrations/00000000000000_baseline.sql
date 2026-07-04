--
-- PostgreSQL database dump
--

\restrict S5Y4zdBfGRESvoHKGhtr2dCrdEAOr4pQctkTToD9aeExpSWMUXePHlwFfosSAr0

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: listing_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.listing_status AS ENUM (
    'active',
    'sold',
    'closed'
);


--
-- Name: listing_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.listing_type AS ENUM (
    'ticket',
    'merchandise'
);


--
-- Name: confirm_deal(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_deal(p_conversation_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_seller_id uuid;
begin
  -- 必須是這個對話的參與者
  if not exists (
    select 1 from conversation_participants
    where conversation_id = p_conversation_id and user_id = auth.uid()
  ) then
    raise exception 'not a participant';
  end if;

  select l.user_id into v_seller_id
  from conversations c
  join listings l on l.id = c.listing_id
  where c.id = p_conversation_id;

  if v_seller_id is null then
    raise exception 'conversation has no listing';
  end if;

  -- 只能寫自己角色的欄位；coalesce 保證寫過就不能改（write-once）
  if auth.uid() = v_seller_id then
    update conversations
    set seller_confirmed_at = coalesce(seller_confirmed_at, now())
    where id = p_conversation_id;
  else
    update conversations
    set buyer_confirmed_at = coalesce(buyer_confirmed_at, now())
    where id = p_conversation_id;
  end if;
end;
$$;


--
-- Name: create_conversation(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_conversation(p_listing_id uuid, p_seller_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_conv_id uuid;
begin
  insert into conversations (listing_id) values (p_listing_id) returning id into v_conv_id;
  insert into conversation_participants (conversation_id, user_id) values (v_conv_id, auth.uid());
  insert into conversation_participants (conversation_id, user_id) values (v_conv_id, p_seller_id);
  return v_conv_id;
end;
$$;


--
-- Name: enforce_listing_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_listing_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_count int;
  v_limit constant int := 3;  -- 球票 3 篇、周邊 3 篇
begin
  if new.status = 'active' then
    select count(*) into v_count
    from listings
    where user_id = new.user_id
      and type = new.type
      and status = 'active'
      and id is distinct from new.id;

    if v_count >= v_limit then
      raise exception '同時上架數量已達上限（% 篇）', v_limit;
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: get_existing_conversation(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_existing_conversation(p_seller_id uuid, p_listing_id uuid) RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
declare
  v_conv_id uuid;
begin
  select cp1.conversation_id into v_conv_id
  from conversation_participants cp1
  join conversation_participants cp2
    on cp1.conversation_id = cp2.conversation_id
  join conversations c
    on c.id = cp1.conversation_id
  where cp1.user_id = auth.uid()
    and cp2.user_id = p_seller_id
    and c.listing_id = p_listing_id
  limit 1;

  return v_conv_id;
end;
$$;


--
-- Name: get_my_conversation_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_conversation_ids() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select conversation_id from conversation_participants
  where user_id = auth.uid()
$$;


--
-- Name: get_my_conversations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_conversations() RETURNS TABLE(id uuid, listing_id uuid, created_at timestamp with time zone, buyer_confirmed_at timestamp with time zone, seller_confirmed_at timestamp with time zone, listing_title text, listing_images text[], other_user_id uuid, other_username text, other_avatar_url text)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select
    c.id,
    c.listing_id,
    c.created_at,
    c.buyer_confirmed_at,
    c.seller_confirmed_at,
    l.title,
    l.images,
    p.id,
    p.username,
    p.avatar_url
  from conversation_participants cp
  join conversations c on c.id = cp.conversation_id
  left join listings l on l.id = c.listing_id
  join conversation_participants cp2 on cp2.conversation_id = c.id and cp2.user_id != auth.uid()
  join profiles p on p.id = cp2.user_id
  where cp.user_id = auth.uid()
  order by c.created_at desc
$$;


--
-- Name: handle_mutual_confirmation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_mutual_confirmation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_listing_id uuid;
  v_seller_id uuid;
  v_buyer_id uuid;
begin
  -- 只在「這次更新後雙方都已確認」且「上一筆狀態不是雙方都確認」時觸發，避免重複加星
  if new.buyer_confirmed_at is not null and new.seller_confirmed_at is not null
     and (old.buyer_confirmed_at is null or old.seller_confirmed_at is null) then

    v_listing_id := new.listing_id;
    select user_id into v_seller_id from listings where id = v_listing_id;

    select cp.user_id into v_buyer_id
    from conversation_participants cp
    where cp.conversation_id = new.id and cp.user_id != v_seller_id
    limit 1;

    -- 避免同一筆交易重複加星：用 reviews 表的 unique 限制擋重複 insert
    if v_buyer_id is not null then
      insert into reviews (reviewer_id, reviewee_id, listing_id, rating)
      values (v_buyer_id, v_seller_id, v_listing_id, 5)
      on conflict (reviewer_id, listing_id) do nothing;

      insert into reviews (reviewer_id, reviewee_id, listing_id, rating)
      values (v_seller_id, v_buyer_id, v_listing_id, 5)
      on conflict (reviewer_id, listing_id) do nothing;

      -- 雙方的星星數量各 +1（用實際 reviews 筆數重新計算，確保準確）
      update profiles set rating_count = (
        select count(*) from reviews where reviewee_id = v_buyer_id
      ) where id = v_buyer_id;

      update profiles set rating_count = (
        select count(*) from reviews where reviewee_id = v_seller_id
      ) where id = v_seller_id;
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;


--
-- Name: increment_view_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_view_count(listing_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  update listings
  set view_count = view_count + 1
  where id = listing_id;
end;
$$;


--
-- Name: is_conversation_participant(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_conversation_participant(conv_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from conversation_participants
    where conversation_id = conv_id and user_id = auth.uid()
  )
$$;


--
-- Name: update_profile_rating(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_profile_rating() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  update profiles
  set
    rating = (
      select round(avg(rating)::numeric, 1)
      from reviews
      where reviewee_id = new.reviewee_id
    ),
    rating_count = (
      select count(*)
      from reviews
      where reviewee_id = new.reviewee_id
    )
  where id = new.reviewee_id;
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    listing_id uuid NOT NULL,
    user_id uuid NOT NULL,
    parent_id uuid,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_participants (
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    listing_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    buyer_confirmed_at timestamp with time zone,
    seller_confirmed_at timestamp with time zone
);


--
-- Name: listings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listings (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    type public.listing_type NOT NULL,
    status public.listing_status DEFAULT 'active'::public.listing_status,
    price integer,
    is_negotiable boolean DEFAULT false,
    location text,
    team text,
    game_date date,
    images text[] DEFAULT '{}'::text[],
    view_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deal_methods text[] DEFAULT '{}'::text[] NOT NULL,
    ticket_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    last_game_date date,
    CONSTRAINT listings_price_check CHECK ((price >= 0))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    image_url text,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text NOT NULL,
    avatar_url text,
    bio text,
    rating numeric(3,2) DEFAULT 0,
    rating_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    is_admin boolean DEFAULT false
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    reviewer_id uuid NOT NULL,
    reviewee_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (conversation_id, user_id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: listings listings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_reviewer_id_listing_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_reviewer_id_listing_id_key UNIQUE (reviewer_id, listing_id);


--
-- Name: idx_comments_listing_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_listing_id ON public.comments USING btree (listing_id);


--
-- Name: idx_listings_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_listings_created_at ON public.listings USING btree (created_at DESC);


--
-- Name: idx_listings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_listings_status ON public.listings USING btree (status);


--
-- Name: idx_listings_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_listings_team ON public.listings USING btree (team);


--
-- Name: idx_listings_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_listings_type ON public.listings USING btree (type);


--
-- Name: idx_listings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_listings_user_id ON public.listings USING btree (user_id);


--
-- Name: idx_messages_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation_id ON public.messages USING btree (conversation_id);


--
-- Name: idx_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at);


--
-- Name: listings on_listing_limit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_listing_limit BEFORE INSERT OR UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.enforce_listing_limit();


--
-- Name: conversations on_mutual_confirmation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_mutual_confirmation AFTER UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.handle_mutual_confirmation();


--
-- Name: reviews on_review_inserted; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_review_inserted AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_profile_rating();


--
-- Name: comments comments_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: comments comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;


--
-- Name: listings listings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_reviewee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_reviewee_id_fkey FOREIGN KEY (reviewee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

--
-- Name: comments comments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_delete ON public.comments FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: comments comments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_insert ON public.comments FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: comments comments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_select ON public.comments FOR SELECT USING (true);


--
-- Name: comments comments_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_update ON public.comments FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: conversation_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations conversations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_insert ON public.conversations FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: conversations conversations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_select ON public.conversations FOR SELECT USING (public.is_conversation_participant(id));


--
-- Name: listings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

--
-- Name: listings listings_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY listings_delete ON public.listings FOR DELETE USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))));


--
-- Name: listings listings_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY listings_insert ON public.listings FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: listings listings_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY listings_select ON public.listings FOR SELECT USING (((status = 'active'::public.listing_status) OR (auth.uid() = user_id)));


--
-- Name: listings listings_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY listings_update ON public.listings FOR UPDATE USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))));


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_insert ON public.messages FOR INSERT WITH CHECK (((auth.uid() = sender_id) AND public.is_conversation_participant(conversation_id)));


--
-- Name: messages messages_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_select ON public.messages FOR SELECT USING (public.is_conversation_participant(conversation_id));


--
-- Name: messages messages_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_update ON public.messages FOR UPDATE USING (public.is_conversation_participant(conversation_id));


--
-- Name: conversation_participants participants_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY participants_insert ON public.conversation_participants FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: conversation_participants participants_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY participants_select ON public.conversation_participants FOR SELECT USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = conversation_participants.conversation_id) AND (cp.user_id = auth.uid()))))));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (true);


--
-- Name: profiles profiles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews reviews_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reviews_insert ON public.reviews FOR INSERT WITH CHECK (((auth.uid() = reviewer_id) AND (auth.uid() <> reviewee_id)));


--
-- Name: reviews reviews_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reviews_select ON public.reviews FOR SELECT USING (true);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION confirm_deal(p_conversation_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.confirm_deal(p_conversation_id uuid) TO anon;
GRANT ALL ON FUNCTION public.confirm_deal(p_conversation_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.confirm_deal(p_conversation_id uuid) TO service_role;


--
-- Name: FUNCTION create_conversation(p_listing_id uuid, p_seller_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_conversation(p_listing_id uuid, p_seller_id uuid) TO anon;
GRANT ALL ON FUNCTION public.create_conversation(p_listing_id uuid, p_seller_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_conversation(p_listing_id uuid, p_seller_id uuid) TO service_role;


--
-- Name: FUNCTION enforce_listing_limit(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.enforce_listing_limit() TO anon;
GRANT ALL ON FUNCTION public.enforce_listing_limit() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_listing_limit() TO service_role;


--
-- Name: FUNCTION get_existing_conversation(p_seller_id uuid, p_listing_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_existing_conversation(p_seller_id uuid, p_listing_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_existing_conversation(p_seller_id uuid, p_listing_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_existing_conversation(p_seller_id uuid, p_listing_id uuid) TO service_role;


--
-- Name: FUNCTION get_my_conversation_ids(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_my_conversation_ids() TO anon;
GRANT ALL ON FUNCTION public.get_my_conversation_ids() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_conversation_ids() TO service_role;


--
-- Name: FUNCTION get_my_conversations(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_my_conversations() TO anon;
GRANT ALL ON FUNCTION public.get_my_conversations() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_conversations() TO service_role;


--
-- Name: FUNCTION handle_mutual_confirmation(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_mutual_confirmation() TO anon;
GRANT ALL ON FUNCTION public.handle_mutual_confirmation() TO authenticated;
GRANT ALL ON FUNCTION public.handle_mutual_confirmation() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION increment_view_count(listing_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.increment_view_count(listing_id uuid) TO anon;
GRANT ALL ON FUNCTION public.increment_view_count(listing_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.increment_view_count(listing_id uuid) TO service_role;


--
-- Name: FUNCTION is_conversation_participant(conv_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_conversation_participant(conv_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_conversation_participant(conv_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_conversation_participant(conv_id uuid) TO service_role;


--
-- Name: FUNCTION update_profile_rating(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_profile_rating() TO anon;
GRANT ALL ON FUNCTION public.update_profile_rating() TO authenticated;
GRANT ALL ON FUNCTION public.update_profile_rating() TO service_role;


--
-- Name: TABLE comments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.comments TO anon;
GRANT ALL ON TABLE public.comments TO authenticated;
GRANT ALL ON TABLE public.comments TO service_role;


--
-- Name: TABLE conversation_participants; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversation_participants TO anon;
GRANT ALL ON TABLE public.conversation_participants TO authenticated;
GRANT ALL ON TABLE public.conversation_participants TO service_role;


--
-- Name: TABLE conversations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversations TO anon;
GRANT ALL ON TABLE public.conversations TO authenticated;
GRANT ALL ON TABLE public.conversations TO service_role;


--
-- Name: TABLE listings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.listings TO anon;
GRANT ALL ON TABLE public.listings TO authenticated;
GRANT ALL ON TABLE public.listings TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.messages TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;


--
-- Name: COLUMN messages.is_read; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(is_read) ON TABLE public.messages TO authenticated;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE reviews; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.reviews TO anon;
GRANT ALL ON TABLE public.reviews TO authenticated;
GRANT ALL ON TABLE public.reviews TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict S5Y4zdBfGRESvoHKGhtr2dCrdEAOr4pQctkTToD9aeExpSWMUXePHlwFfosSAr0

