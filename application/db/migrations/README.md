# Database migrations (Pathwise)

Run incremental migrations in order from the `application/db/migrations` directory on EC2:

1. `001_m3_users_bookmarks.sql`
2. `002_m3_goals_projects_milestones.sql`
3. `003_m3_seed_demo.sql` (optional demo data)
4. `004_m4_roles_userprofiles.sql` (user `role`, `UserProfiles`)
5. `005_reflections_activity.sql` (`Reflections`, `ActivityLogs`)
6. `006_ratings_messages.sql` (`ResourceRatings`, `Messages`)
7. `007_templates_workflows.sql` (`CommunityTemplates`, `Workflows`, template/workflow attachment links)
8. `008_goal_template_copy_links.sql` (goal-template project/milestone/resource copy tables)
9. `009_shares_reports_support.sql` (`Shares`)
10. `010_visibility_hardening.sql` (`Resources.visibility`, `Resources.is_ai_enabled`, `Resources.skill_area` safety)
11. `011_goal_templates_as_goals.sql` (`Goals.template_kind`, `Goals.template_copied_count`, `GoalTemplateRatings`)
12. `012_admin_resource_moderation.sql` (adds `admin` user role and `Resources.moderation_status`)
13. `013_ai_goal_tokens.sql` (adds `Users.ai_goal_tokens` with default/backfill of 5)
14. `014_password_reset_tokens.sql` (`PasswordResetTokens` for forgot-password flow)

`007` and `010` add `Resources` columns only when missing (Oracle MySQL does not support `ADD COLUMN IF NOT EXISTS`). Other steps use `CREATE TABLE IF NOT EXISTS` where applicable.

Example:

```bash
cd /var/www/html/db/migrations
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p "$DB_NAME" < 001_m3_users_bookmarks.sql
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p "$DB_NAME" < 002_m3_goals_projects_milestones.sql
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p "$DB_NAME" < 003_m3_seed_demo.sql
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p "$DB_NAME" < 007_templates_workflows.sql
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p "$DB_NAME" < 008_goal_template_copy_links.sql
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p "$DB_NAME" < 009_shares_reports_support.sql
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p "$DB_NAME" < 010_visibility_hardening.sql
```

**Windows (PowerShell):** `< file.sql` does not work for piping into `mysql`. From `application\db\migrations`, with Docker MySQL container `pathwise-mysql`:

```powershell
Get-Content .\007_templates_workflows.sql -Raw | docker exec -i pathwise-mysql mysql -uroot -prootpass pathwise
Get-Content .\008_goal_template_copy_links.sql -Raw | docker exec -i pathwise-mysql mysql -uroot -prootpass pathwise
Get-Content .\009_shares_reports_support.sql -Raw | docker exec -i pathwise-mysql mysql -uroot -prootpass pathwise
Get-Content .\010_visibility_hardening.sql -Raw | docker exec -i pathwise-mysql mysql -uroot -prootpass pathwise
Get-Content .\011_goal_templates_as_goals.sql -Raw | docker exec -i pathwise-mysql mysql -uroot -prootpass pathwise
Get-Content .\012_admin_resource_moderation.sql -Raw | docker exec -i pathwise-mysql mysql -uroot -prootpass pathwise
Get-Content .\013_ai_goal_tokens.sql -Raw | docker exec -i pathwise-mysql mysql -uroot -prootpass pathwise
```

Verify:

```sql
SHOW TABLES;
DESCRIBE Goals;
DESCRIBE Projects;
DESCRIBE Milestones;
DESCRIBE CommunityTemplates;
DESCRIBE Workflows;
DESCRIBE Shares;
```

## Fresh database bootstrap

For a brand-new database, run:

```bash
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p "$DB_NAME" < masterMigration.sql
```

Then optionally run:

```bash
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p "$DB_NAME" < 003_m3_seed_demo.sql
```

Use **either** the single `masterMigration.sql` path (fresh DB) **or** the incremental path above (existing DB), not both.

---

## M3 — `001_m3_users_bookmarks.sql`

Creates:

- **`Users`** — `user_id`, `email`, `username`, `password_hash`, `created_at`
- **`Bookmarks`** — composite PK `(user_id, resource_id)` with FKs to `Users` and `Resources`
- **`Resources`** — adds **`submitted_by`** (nullable FK to `Users`) and **`cost`** (nullable `VARCHAR(32)` for filters like free/paid)

Existing seeded rows keep `submitted_by = NULL` and `cost = NULL`.

### How to apply

1. Connect to **RDS** (not localhost MySQL), database **`pathwise`**:

   ```bash
   mysql -h pathwise-db.c18i0cuaoe4f.us-east-2.rds.amazonaws.com -P 3306 -u team2 -p pathwise
   ```

2. Either paste the SQL from `001_m3_users_bookmarks.sql`, or from your machine:

   ```bash
   mysql -h <RDS_HOST> -P 3306 -u <USER> -p pathwise < application/db/migrations/001_m3_users_bookmarks.sql
   ```

3. Verify:

   ```sql
   SHOW TABLES;
   DESCRIBE Users;
   DESCRIBE Bookmarks;
   DESCRIBE Resources;
   ```

### Re-running

`007` and `010` are safe to re-run for the conditional `Resources` column adds. For **`001`**, do **not** run the `ALTER TABLE Resources ADD COLUMN submitted_by/cost` block twice (duplicate column error). `CREATE TABLE IF NOT EXISTS` in other files is fine to re-run. To reset a dev DB, drop objects in reverse dependency order before re-applying.
