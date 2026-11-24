-- Applied to Supabase project jrhihuaswonlcdkhoabf.
-- Remove privileges that bypass row-level security or are not needed by the client.
REVOKE ALL PRIVILEGES ON TABLE
  public.mizan_documents,
  public.mizan_goal_contributions,
  public.mizan_goals,
  public.mizan_market_snapshots,
  public.mizan_reminders
FROM anon;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.mizan_documents,
  public.mizan_goal_contributions,
  public.mizan_goals,
  public.mizan_market_snapshots,
  public.mizan_reminders
FROM authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.mizan_goal_progress FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.mizan_goal_progress FROM authenticated;
GRANT SELECT ON TABLE public.mizan_goal_progress TO authenticated;
