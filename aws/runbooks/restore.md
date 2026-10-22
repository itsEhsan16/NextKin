# Restore

**Owner role:** Data owner · **Approver:** IC (a restore loses whatever was written after the restore point)

## Targets

- **RPO** (data you can lose): 5 minutes in the cloud, from Aurora's continuous backup (cloud, X-05).
- **RTO** (time to serve again): 1 hour.
- Locally there is no backup. The drill below measures the dump-and-restore path that the cloud
  procedure also uses for a logical copy.

## Decide

1. What is wrong: lost rows, corrupted rows, or a dropped table? From when?
2. Can it be fixed forward instead? A bad migration fixed by a new migration loses nothing. A
   restore loses everything written after the restore point.
3. Restore **beside** production, never over it. Repoint only after checks pass.

## Cloud steps (X-05)

1. Point-in-time restore of the Aurora cluster to a new cluster, at a time just before the damage.
2. Run the checks below against the new cluster.
3. To recover a few rows, copy them back with the maintenance role and audit the copy. Otherwise,
   for a full repoint: kill switches on, the worker stopped, the database secret switched to the new
   cluster, a rolling restart, the worker started again.
4. Valkey holds only sessions, rate limits and caches. After a full repoint, users sign in again.
5. Objects in S3 are versioned. A database restored to an earlier point can reference an object
   deleted later; the restore is checked for that, and the object is recovered from its previous
   version.

## Local drill

```sh
node scripts/drills/restore.mjs --volume 5000
```

It seeds synthetic volume users (L4), takes `pg_dump -Fc` inside the container, and restores into a
fresh `nextkin_restore` with `pg_restore -j 4` as the superuser, with ownership kept. It grants
CONNECT to the app, maintenance and read-only roles, compares row counts, reads as the app role
under RLS, and prints the time of each step. The results go in [`aws/drills/`](../drills/).
Remove the volume users afterwards with `pnpm seed -- --remove-volume`.

**Gotcha:** restoring with `--no-owner --role=nextkin_owner` fails with "query would be affected by
row-level security policy". Under FORCE RLS even the owner is filtered during COPY. Restore as the
superuser with ownership kept, as the script does. In the cloud, the restore is a cluster restore,
so this does not arise.

## Checks before repointing

- Row counts for `users`, `resumes`, `resume_versions` and `generations` look right for the restore
  point.
- `pnpm migrate` reports nothing to apply (the schema is current).
- The app role can read under RLS; the RLS suite (`rls.int.test.ts`) passes against the restored
  database.
- One sign-in and one generation work end to end.
