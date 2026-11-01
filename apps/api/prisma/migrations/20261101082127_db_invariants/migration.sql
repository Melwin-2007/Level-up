-- ====================================================================
-- DB INVARIANTS: CHECK CONSTRAINTS, PARTIAL INDEXES, AND TRIGGERS
-- ====================================================================

-- 1. CHECK CONSTRAINTS

ALTER TABLE "group_members"
  ADD CONSTRAINT "chk_group_members_role"
  CHECK ("role" IN ('owner', 'admin', 'member'));

ALTER TABLE "monthly_cycles"
  ADD CONSTRAINT "chk_monthly_cycles_status"
  CHECK ("status" IN ('submission_open', 'group_review', 'planning', 'execution', 'completed', 'cancelled')),
  ADD CONSTRAINT "chk_monthly_cycles_month"
  CHECK ("month" >= 1 AND "month" <= 12);

ALTER TABLE "monthly_submissions"
  ADD CONSTRAINT "chk_monthly_submissions_status"
  CHECK ("status" IN ('draft', 'submitted', 'locked'));

ALTER TABLE "submission_goals"
  ADD CONSTRAINT "chk_submission_goals_priority"
  CHECK ("priority" >= 1 AND "priority" <= 5);

ALTER TABLE "plan_versions"
  ADD CONSTRAINT "chk_plan_versions_version_type"
  CHECK ("version_type" IN ('initial', 'reoptimized')),
  ADD CONSTRAINT "chk_plan_versions_approval_status"
  CHECK ("approval_status" IN ('pending', 'approved', 'rejected'));

ALTER TABLE "plan_items"
  ADD CONSTRAINT "chk_plan_items_item_type"
  CHECK ("item_type" IN ('milestone', 'weekly_task', 'daily_task'));

ALTER TABLE "tasks"
  ADD CONSTRAINT "chk_tasks_status"
  CHECK ("status" IN ('pending', 'in_progress', 'completed', 'postponed', 'cancelled'));

ALTER TABLE "monthly_reports"
  ADD CONSTRAINT "chk_monthly_reports_report_type"
  CHECK ("report_type" IN ('individual', 'group')),
  ADD CONSTRAINT "chk_monthly_reports_user_scope"
  CHECK (("report_type" = 'individual' AND "user_id" IS NOT NULL) OR ("report_type" = 'group' AND "user_id" IS NULL));


-- 2. PARTIAL UNIQUE INDEX

CREATE UNIQUE INDEX "one_baseline_per_member_cycle"
  ON "plan_versions" ("cycle_id", "user_id")
  WHERE "is_baseline" = true;


-- 3. IMMUTABILITY TRIGGERS

-- A. submission_goals: cannot INSERT, UPDATE, or DELETE if parent submission is locked
CREATE OR REPLACE FUNCTION check_submission_goals_lock()
RETURNS TRIGGER AS $$
DECLARE
  target_sub_id UUID;
  sub_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_sub_id := OLD.submission_id;
  ELSE
    target_sub_id := NEW.submission_id;
  END IF;

  SELECT status INTO sub_status FROM monthly_submissions WHERE id = target_sub_id;
  IF sub_status = 'locked' THEN
    RAISE EXCEPTION 'Cannot % submission goal: parent submission is locked', TG_OP;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_submission_goals_lock
BEFORE INSERT OR UPDATE OR DELETE ON "submission_goals"
FOR EACH ROW EXECUTE FUNCTION check_submission_goals_lock();


-- B. monthly_submissions: if status is locked, reject changes to availability, constraints, or status
CREATE OR REPLACE FUNCTION check_monthly_submissions_lock()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'locked' THEN
    IF (OLD.availability IS DISTINCT FROM NEW.availability) OR
       (OLD.constraints IS DISTINCT FROM NEW.constraints) OR
       (OLD.status IS DISTINCT FROM NEW.status) THEN
      RAISE EXCEPTION 'Cannot modify availability, constraints, or status of a locked submission';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_monthly_submissions_lock
BEFORE UPDATE ON "monthly_submissions"
FOR EACH ROW EXECUTE FUNCTION check_monthly_submissions_lock();


-- C. plan_versions:
--    - If version_type <> 'initial', is_baseline must be false.
--    - On UPDATE: reject changes to plan_snapshot, version_type, version_number, cycle_id, user_id.
CREATE OR REPLACE FUNCTION check_plan_versions_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.version_type <> 'initial' AND NEW.is_baseline = true THEN
      RAISE EXCEPTION 'Only initial plan versions can be marked as baseline';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.version_type <> 'initial' AND NEW.is_baseline = true THEN
      RAISE EXCEPTION 'Only initial plan versions can be marked as baseline';
    END IF;

    IF (OLD.plan_snapshot IS DISTINCT FROM NEW.plan_snapshot) OR
       (OLD.version_type IS DISTINCT FROM NEW.version_type) OR
       (OLD.version_number IS DISTINCT FROM NEW.version_number) OR
       (OLD.cycle_id IS DISTINCT FROM NEW.cycle_id) OR
       (OLD.user_id IS DISTINCT FROM NEW.user_id) THEN
      RAISE EXCEPTION 'Plan version content is immutable once created. Only approval status, approved_at, and is_baseline may change';
    END IF;

    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_plan_versions_immutability
BEFORE INSERT OR UPDATE ON "plan_versions"
FOR EACH ROW EXECUTE FUNCTION check_plan_versions_immutability();


-- D. plan_items: always reject UPDATE or DELETE
CREATE OR REPLACE FUNCTION check_plan_items_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Plan items are immutable and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_plan_items_immutable
BEFORE UPDATE OR DELETE ON "plan_items"
FOR EACH ROW EXECUTE FUNCTION check_plan_items_immutable();


-- E. task_logs: always reject UPDATE or DELETE
CREATE OR REPLACE FUNCTION check_task_logs_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Task logs are append-only and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_logs_immutable
BEFORE UPDATE OR DELETE ON "task_logs"
FOR EACH ROW EXECUTE FUNCTION check_task_logs_immutable();


-- F. xp_transactions: always reject UPDATE or DELETE
CREATE OR REPLACE FUNCTION check_xp_transactions_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'XP transactions are append-only and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_xp_transactions_immutable
BEFORE UPDATE OR DELETE ON "xp_transactions"
FOR EACH ROW EXECUTE FUNCTION check_xp_transactions_immutable();
