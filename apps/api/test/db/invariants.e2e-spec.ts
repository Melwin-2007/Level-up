import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { config } from 'dotenv';
import { validateEnv } from '../../src/config/env.schema.js';

config();

describe('Database Invariants and Immutability Triggers (e2e)', () => {
  let client: pg.Client;
  const env = validateEnv(process.env);

  // Test entities IDs for isolation
  const testUserId = randomUUID();
  const testGroupId = randomUUID();
  const testCycleId = randomUUID();
  const testSubmissionId = randomUUID();
  const testGoalId = randomUUID();
  const testInviteCode = 'I' + randomUUID().replace(/-/g, '').substring(0, 7).toUpperCase();

  beforeAll(async () => {
    client = new pg.Client({
      connectionString: env.DIRECT_URL,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    // Setup base fixtures
    await client.query(`
      INSERT INTO profiles (id, display_name, timezone, updated_at)
      VALUES ('${testUserId}', 'Invariant Tester', 'UTC', NOW());

      INSERT INTO groups (id, name, owner_id, invite_code, updated_at)
      VALUES ('${testGroupId}', 'Test Invariants Group', '${testUserId}', '${testInviteCode}', NOW());

      INSERT INTO monthly_cycles (id, group_id, year, month, status, submission_deadline, review_deadline, updated_at)
      VALUES ('${testCycleId}', '${testGroupId}', 2026, 11, 'submission_open', NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days', NOW());

      INSERT INTO monthly_submissions (id, cycle_id, user_id, status, availability, constraints, updated_at)
      VALUES ('${testSubmissionId}', '${testCycleId}', '${testUserId}', 'submitted', '{}', '{}', NOW());

      INSERT INTO submission_goals (id, submission_id, title, priority, position, updated_at)
      VALUES ('${testGoalId}', '${testSubmissionId}', 'Sample Goal', 1, 0, NOW());
    `);
  });

  afterAll(async () => {
    // Clean up test data in reverse order of dependencies
    await client
      .query(
        `
      DELETE FROM xp_transactions WHERE user_id = '${testUserId}';
      DELETE FROM task_logs WHERE user_id = '${testUserId}';
      DELETE FROM tasks WHERE user_id = '${testUserId}';
      DELETE FROM plan_items WHERE plan_version_id IN (SELECT id FROM plan_versions WHERE user_id = '${testUserId}');
      DELETE FROM plan_versions WHERE user_id = '${testUserId}';
      DELETE FROM submission_goals WHERE submission_id = '${testSubmissionId}';
      DELETE FROM monthly_submissions WHERE id = '${testSubmissionId}';
      DELETE FROM monthly_cycles WHERE id = '${testCycleId}';
      DELETE FROM groups WHERE id = '${testGroupId}';
      DELETE FROM profiles WHERE id = '${testUserId}';
    `
      )
      .catch(() => {});

    await client.end();
  });

  it('should reject invalid status values via CHECK constraints', async () => {
    // Invalid monthly_cycles status
    await expect(
      client.query(`
        INSERT INTO monthly_cycles (id, group_id, year, month, status, submission_deadline, review_deadline, updated_at)
        VALUES ('${randomUUID()}', '${testGroupId}', 2026, 12, 'invalid_status', NOW(), NOW(), NOW());
      `)
    ).rejects.toThrowError(/chk_monthly_cycles_status/);

    // Invalid month range
    await expect(
      client.query(`
        INSERT INTO monthly_cycles (id, group_id, year, month, status, submission_deadline, review_deadline, updated_at)
        VALUES ('${randomUUID()}', '${testGroupId}', 2026, 13, 'submission_open', NOW(), NOW(), NOW());
      `)
    ).rejects.toThrowError(/chk_monthly_cycles_month/);

    // Invalid priority range on submission_goals
    await expect(
      client.query(`
        INSERT INTO submission_goals (id, submission_id, title, priority, position, updated_at)
        VALUES ('${randomUUID()}', '${testSubmissionId}', 'Invalid Priority', 10, 1, NOW());
      `)
    ).rejects.toThrowError(/chk_submission_goals_priority/);
  });

  it('should prevent insert, update, and delete on submission_goals once parent submission is locked', async () => {
    // Lock the submission
    await client.query(`
      UPDATE monthly_submissions
      SET status = 'locked', locked_at = NOW()
      WHERE id = '${testSubmissionId}';
    `);

    // 1. UPDATE on submission_goals must be rejected
    await expect(
      client.query(`
        UPDATE submission_goals
        SET title = 'Changed Title'
        WHERE id = '${testGoalId}';
      `)
    ).rejects.toThrowError(/Cannot UPDATE submission goal: parent submission is locked/);

    // 2. INSERT into locked submission must be rejected
    await expect(
      client.query(`
        INSERT INTO submission_goals (id, submission_id, title, priority, position, updated_at)
        VALUES ('${randomUUID()}', '${testSubmissionId}', 'New Goal in Locked Sub', 2, 2, NOW());
      `)
    ).rejects.toThrowError(/Cannot INSERT submission goal: parent submission is locked/);

    // 3. DELETE on locked submission goals must be rejected
    await expect(
      client.query(`
        DELETE FROM submission_goals WHERE id = '${testGoalId}';
      `)
    ).rejects.toThrowError(/Cannot DELETE submission goal: parent submission is locked/);

    // 4. Updating availability or constraints on locked submission must be rejected
    await expect(
      client.query(`
        UPDATE monthly_submissions
        SET availability = '{"hours": 40}'
        WHERE id = '${testSubmissionId}';
      `)
    ).rejects.toThrowError(
      /Cannot modify availability, constraints, or status of a locked submission/
    );
  });

  it('should reject reoptimized plan version created with is_baseline = true', async () => {
    const pvId = randomUUID();
    await expect(
      client.query(`
        INSERT INTO plan_versions (id, cycle_id, user_id, version_number, version_type, approval_status, is_baseline, plan_snapshot)
        VALUES ('${pvId}', '${testCycleId}', '${testUserId}', 1, 'reoptimized', 'pending', true, '{}');
      `)
    ).rejects.toThrowError(/Only initial plan versions can be marked as baseline/);
  });

  it('should enforce only one baseline plan version per member per cycle', async () => {
    const v1Id = randomUUID();
    const v2Id = randomUUID();

    // First baseline succeeds
    await client.query(`
      INSERT INTO plan_versions (id, cycle_id, user_id, version_number, version_type, approval_status, is_baseline, plan_snapshot)
      VALUES ('${v1Id}', '${testCycleId}', '${testUserId}', 1, 'initial', 'approved', true, '{}');
    `);

    // Second baseline for same member & cycle must fail via partial unique index
    await expect(
      client.query(`
        INSERT INTO plan_versions (id, cycle_id, user_id, version_number, version_type, approval_status, is_baseline, plan_snapshot)
        VALUES ('${v2Id}', '${testCycleId}', '${testUserId}', 2, 'initial', 'approved', true, '{}');
      `)
    ).rejects.toThrowError(/one_baseline_per_member_cycle/);
  });

  it('should reject UPDATE and DELETE on plan_items', async () => {
    const pvId = randomUUID();
    const itemId = randomUUID();

    await client.query(`
      INSERT INTO plan_versions (id, cycle_id, user_id, version_number, version_type, approval_status, is_baseline, plan_snapshot)
      VALUES ('${pvId}', '${testCycleId}', '${testUserId}', 10, 'initial', 'pending', false, '{}');

      INSERT INTO plan_items (id, plan_version_id, item_type, title, estimated_minutes, order_index)
      VALUES ('${itemId}', '${pvId}', 'milestone', 'Finish Schema', 60, 0);
    `);

    await expect(
      client.query(`UPDATE plan_items SET title = 'Edited Milestone' WHERE id = '${itemId}';`)
    ).rejects.toThrowError(/Plan items are immutable and cannot be updated or deleted/);

    await expect(
      client.query(`DELETE FROM plan_items WHERE id = '${itemId}';`)
    ).rejects.toThrowError(/Plan items are immutable and cannot be updated or deleted/);
  });

  it('should reject UPDATE and DELETE on task_logs', async () => {
    const taskId = randomUUID();
    const logId = randomUUID();

    await client.query(`
      INSERT INTO tasks (id, cycle_id, user_id, title, status, estimated_minutes, actual_minutes, updated_at)
      VALUES ('${taskId}', '${testCycleId}', '${testUserId}', 'Test Task', 'pending', 30, 0, NOW());

      INSERT INTO task_logs (id, task_id, user_id, action, duration_minutes)
      VALUES ('${logId}', '${taskId}', '${testUserId}', 'started', 0);
    `);

    await expect(
      client.query(`UPDATE task_logs SET note = 'Tampered Log' WHERE id = '${logId}';`)
    ).rejects.toThrowError(/Task logs are append-only and cannot be updated or deleted/);

    await expect(client.query(`DELETE FROM task_logs WHERE id = '${logId}';`)).rejects.toThrowError(
      /Task logs are append-only and cannot be updated or deleted/
    );
  });

  it('should reject UPDATE and DELETE on xp_transactions', async () => {
    const txId = randomUUID();

    await client.query(`
      INSERT INTO xp_transactions (id, user_id, amount, reason, idempotency_key)
      VALUES ('${txId}', '${testUserId}', 100, 'daily_completion', 'key-${randomUUID()}');
    `);

    await expect(
      client.query(`UPDATE xp_transactions SET amount = 200 WHERE id = '${txId}';`)
    ).rejects.toThrowError(/XP transactions are append-only and cannot be updated or deleted/);

    await expect(
      client.query(`DELETE FROM xp_transactions WHERE id = '${txId}';`)
    ).rejects.toThrowError(/XP transactions are append-only and cannot be updated or deleted/);
  });
});
