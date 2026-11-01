-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

-- 0. SHADOW DB COMPATIBILITY (auth.uid stub only if absent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    CREATE SCHEMA auth;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
    WHERE pg_namespace.nspname = 'auth' AND proname = 'uid'
  ) THEN
    EXECUTE 'CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS ''SELECT null::uuid;''';
  END IF;
END $$;

-- 1. ENABLE RLS ON ALL TABLES
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "monthly_cycles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "monthly_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "submission_goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "review_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plan_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plan_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "monthly_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "xp_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_action_logs" ENABLE ROW LEVEL SECURITY;

-- 2. CREATE POLICIES

-- profiles: select, insert, update own row
CREATE POLICY "profiles_select_own" ON "profiles"
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON "profiles"
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON "profiles"
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- groups: members can view their group
CREATE POLICY "groups_select_member" ON "groups"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "group_members"
      WHERE "group_members"."group_id" = "groups"."id"
        AND "group_members"."user_id" = auth.uid()
    )
  );

-- group_members: members can view membership of groups they belong to
CREATE POLICY "group_members_select_member" ON "group_members"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "group_members" gm
      WHERE gm."group_id" = "group_members"."group_id"
        AND gm."user_id" = auth.uid()
    )
  );

-- monthly_cycles: members of the group can view cycles
CREATE POLICY "monthly_cycles_select_member" ON "monthly_cycles"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "group_members" gm
      WHERE gm."group_id" = "monthly_cycles"."group_id"
        AND gm."user_id" = auth.uid()
    )
  );

-- monthly_submissions: select/insert/update own row (update only if not locked)
CREATE POLICY "monthly_submissions_select_own" ON "monthly_submissions"
  FOR SELECT USING (auth.uid() = "user_id");

CREATE POLICY "monthly_submissions_insert_own" ON "monthly_submissions"
  FOR INSERT WITH CHECK (auth.uid() = "user_id");

CREATE POLICY "monthly_submissions_update_own" ON "monthly_submissions"
  FOR UPDATE USING (auth.uid() = "user_id" AND "status" <> 'locked')
  WITH CHECK (auth.uid() = "user_id");

-- submission_goals:
-- select own goals, or others' goals only when submitted/locked during group_review or later
CREATE POLICY "submission_goals_select" ON "submission_goals"
  FOR SELECT USING (
    (EXISTS (
      SELECT 1 FROM "monthly_submissions" s
      WHERE s."id" = "submission_goals"."submission_id"
        AND s."user_id" = auth.uid()
    ))
    OR
    (EXISTS (
      SELECT 1 FROM "monthly_submissions" s
      JOIN "monthly_cycles" c ON c."id" = s."cycle_id"
      JOIN "group_members" gm ON gm."group_id" = c."group_id"
      WHERE s."id" = "submission_goals"."submission_id"
        AND gm."user_id" = auth.uid()
        AND s."status" IN ('submitted', 'locked')
        AND c."status" IN ('group_review', 'planning', 'execution', 'completed')
    ))
  );

CREATE POLICY "submission_goals_insert_own" ON "submission_goals"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "monthly_submissions" s
      WHERE s."id" = "submission_goals"."submission_id"
        AND s."user_id" = auth.uid()
        AND s."status" <> 'locked'
    )
  );

CREATE POLICY "submission_goals_update_own" ON "submission_goals"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "monthly_submissions" s
      WHERE s."id" = "submission_goals"."submission_id"
        AND s."user_id" = auth.uid()
        AND s."status" <> 'locked'
    )
  );

CREATE POLICY "submission_goals_delete_own" ON "submission_goals"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM "monthly_submissions" s
      WHERE s."id" = "submission_goals"."submission_id"
        AND s."user_id" = auth.uid()
        AND s."status" <> 'locked'
    )
  );

-- group_reviews: viewable by group members
CREATE POLICY "group_reviews_select_member" ON "group_reviews"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "monthly_cycles" c
      JOIN "group_members" gm ON gm."group_id" = c."group_id"
      WHERE c."id" = "group_reviews"."cycle_id"
        AND gm."user_id" = auth.uid()
    )
  );

-- review_comments: select if member of cycle's group; insert only as author_id = auth.uid()
CREATE POLICY "review_comments_select_member" ON "review_comments"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "group_reviews" r
      JOIN "monthly_cycles" c ON c."id" = r."cycle_id"
      JOIN "group_members" gm ON gm."group_id" = c."group_id"
      WHERE r."id" = "review_comments"."review_id"
        AND gm."user_id" = auth.uid()
    )
  );

CREATE POLICY "review_comments_insert_author" ON "review_comments"
  FOR INSERT WITH CHECK (
    "author_id" = auth.uid() AND
    EXISTS (
      SELECT 1 FROM "group_reviews" r
      JOIN "monthly_cycles" c ON c."id" = r."cycle_id"
      JOIN "group_members" gm ON gm."group_id" = c."group_id"
      WHERE r."id" = "review_comments"."review_id"
        AND gm."user_id" = auth.uid()
    )
  );

-- goals: own rows only
CREATE POLICY "goals_all_own" ON "goals"
  FOR ALL USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());

-- plan_versions: own rows only
CREATE POLICY "plan_versions_all_own" ON "plan_versions"
  FOR ALL USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());

-- plan_items: own items only via plan_version
CREATE POLICY "plan_items_all_own" ON "plan_items"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "plan_versions" pv
      WHERE pv."id" = "plan_items"."plan_version_id"
        AND pv."user_id" = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "plan_versions" pv
      WHERE pv."id" = "plan_items"."plan_version_id"
        AND pv."user_id" = auth.uid()
    )
  );

-- tasks: own rows only
CREATE POLICY "tasks_all_own" ON "tasks"
  FOR ALL USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());

-- task_logs: own rows only
CREATE POLICY "task_logs_all_own" ON "task_logs"
  FOR ALL USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());

-- monthly_reports: individual report own rows, group report group members
CREATE POLICY "monthly_reports_select" ON "monthly_reports"
  FOR SELECT USING (
    ("report_type" = 'individual' AND "user_id" = auth.uid())
    OR
    ("report_type" = 'group' AND EXISTS (
      SELECT 1 FROM "monthly_cycles" c
      JOIN "group_members" gm ON gm."group_id" = c."group_id"
      WHERE c."id" = "monthly_reports"."cycle_id"
        AND gm."user_id" = auth.uid()
    ))
  );

-- xp_transactions: own rows only
CREATE POLICY "xp_transactions_select_own" ON "xp_transactions"
  FOR SELECT USING ("user_id" = auth.uid());

-- ai_action_logs: own rows only
CREATE POLICY "ai_action_logs_select_own" ON "ai_action_logs"
  FOR SELECT USING ("user_id" = auth.uid());
