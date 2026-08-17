# 💾 Runbook 02: Database Point-in-Time Recovery & Restore

> Procedure for restoring PostgreSQL database from automated backups and WAL archives.

---

## 1. Emergency Restore Scenarios
- Data corruption due to bad migration or malicious operation.
- Primary database hardware failure where automatic failover did not execute.

---

## 2. Restoring from Daily Dump (Full Restore)

```bash
# Step 1: Stop application backend instances to prevent concurrent writes
kubectl scale deployment/ridenow-backend --replicas=0

# Step 2: Download target backup file from S3
aws s3 cp s3://ridenow-backups-prod/db/backup-2026-08-08.dump.gz ./backup.dump.gz

# Step 3: Decompress backup
gunzip backup.dump.gz

# Step 4: Drop existing damaged database and recreate empty shell
pg_restore -h localhost -U ridenow_admin -d postgres --clean --create backup.dump

# Step 5: Verify postgis extension and Flyway schema history table integrity
psql -h localhost -U ridenow_admin -d ridenow_prod -c "SELECT COUNT(*) FROM flyway_schema_history;"
psql -h localhost -U ridenow_admin -d ridenow_prod -c "SELECT PostGIS_Full_Version();"

# Step 6: Scale back application pods
kubectl scale deployment/ridenow-backend --replicas=2
```

---

## 3. Point-in-Time Recovery (PITR using AWS RDS)

1. Open AWS RDS Console -> Databases -> Select `ridenow-prod-db`.
2. Click **Actions** -> **Restore to point in time**.
3. Select **Custom time** and enter exact UTC timestamp prior to the incident (e.g. `2026-08-08 14:22:00 UTC`).
4. Set Target DB Instance Identifier to `ridenow-prod-db-restored`.
5. Once launched, verify data integrity on `ridenow-prod-db-restored`.
6. Update App environment secret `DB_HOST` to point to the restored DB endpoint and restart backend.
