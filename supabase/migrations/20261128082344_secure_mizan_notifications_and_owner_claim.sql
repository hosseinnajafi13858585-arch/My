-- Keep notification records inaccessible to anonymous sessions and prevent authenticated clients from bypassing RLS with table-wide privileges.
REVOKE ALL PRIVILEGES ON TABLE public.mizan_notifications FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.mizan_notifications FROM authenticated;

-- The signup screen only needs to know whether the singleton owner row exists.
-- Column-level SELECT avoids exposing the owner's auth user_id to anonymous sessions.
GRANT SELECT (singleton_id) ON TABLE public.app_owner TO anon;
