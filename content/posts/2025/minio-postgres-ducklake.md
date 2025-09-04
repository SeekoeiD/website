+++
title = 'MinIO, PostgreSQL, and DuckLake'
date = 2025-09-02T14:08:22+02:00
draft = false
tags = ['minio', 'postgres', 'duckdb', 'zfs', 'ubuntu']
+++

Setting up a modern data lake architecture combining MinIO for object storage, PostgreSQL for metadata, and DuckLake for lakehouse functionality. This setup provides a powerful foundation for analytical workloads with the flexibility to store data in S3-compatible object storage while maintaining ACID transactions and schema management.

## The Architecture

* **MinIO**: S3-compatible object storage for data files (Parquet, etc.)
* **PostgreSQL**: Metadata catalog and traditional RDBMS features
* **DuckLake**: Lakehouse layer providing ACID transactions on object storage
* **ZFS**: Optimized storage backend with compression and reliability

This combination gives you the best of both worlds: the scalability of object storage with the reliability and query performance of a traditional database.

---

## 🗄️ MinIO Installation

### Install MinIO with GUI Support

We'll use an older version that includes the full GUI (which was removed from the community edition):

```bash
wget https://dl.min.io/server/minio/release/linux-amd64/archive/minio_20250422221226.0.0_amd64.deb -O minio.deb
dpkg -i minio.deb
```

### Create Optimized ZFS Dataset

Create a dedicated ZFS dataset optimized for MinIO's storage patterns:

```bash
# Create dataset for MinIO data
zfs create pool/minio

# Properties tuned for already-compressed small files
zfs set compression=lz4           pool/minio   # only compresses metadata & stragglers
zfs set recordsize=64K            pool/minio   # balances small objects vs throughput
zfs set atime=off                 pool/minio   # stop atime updates on every read
zfs set xattr=sa                  pool/minio   # store xattrs efficiently
zfs set dnodesize=auto            pool/minio   # works well with xattr=sa
zfs set redundant_metadata=most   pool/minio   # cut metadata overhead, still safe
zfs set logbias=latency           pool/minio   # safer default for small sync writes
```

**Why these settings?**

* `compression=lz4`: Fast compression for metadata, since DuckLake handles data compression
* `recordsize=64K`: Optimal balance for small objects and throughput
* `atime=off`: Reduces I/O overhead for frequent object access
* `xattr=sa`: Efficient extended attribute storage for object metadata

---

## 👤 User Setup

Create a dedicated user for MinIO:

```bash
groupadd -r minio-user
useradd -M -r -g minio-user minio-user
chown minio-user:minio-user /pool/minio
```

---

## ⚙️ MinIO Configuration

Create the MinIO configuration file:

Edit `/etc/default/minio`:

```ini
# Root user credentials for MinIO administration
# Change these from defaults for security!
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin

# Storage volume path for MinIO server
MINIO_VOLUMES="/pool/minio"

# Additional command line options
# Console on port 9001, API on default 9000
MINIO_OPTS="--console-address :9001"

# Enable public Prometheus metrics endpoint
MINIO_PROMETHEUS_AUTH_TYPE="public"
```

**Security Note**: Change the default credentials in production environments!

### Start MinIO Service

```bash
systemctl enable minio.service
systemctl start minio.service
systemctl status minio.service
journalctl -f -u minio.service
```

### Initial Setup

Access the MinIO console at `http://your-server:9001` and:

* Create API credentials from the GUI
* Create the `ducklake` bucket for data storage

---

## 🦆 DuckDB and DuckLake Setup

### Configure Secrets and Extensions

In the DuckDB client, set up the necessary secrets and extensions:

```sql
-- Clean up any existing default secrets
DROP SECRET __default_s3;
DROP SECRET __default_postgres;

-- Create S3 secret for MinIO connection
CREATE SECRET (
    TYPE S3,
    KEY_ID '4SPjnclI7rvsZFzOYQRA',
    SECRET '3L0nn8JxsiroPrPUeoU6Z1ZvMvzJY6xoCqSJfKuP',
    ENDPOINT 'worker7:9000',
    USE_SSL false,
    URL_STYLE 'path'
);

-- Create PostgreSQL secret for metadata catalog
CREATE SECRET (
    TYPE 'postgres',
    HOST 'worker7',
    PORT 5432,
    DATABASE 'ducklake',
    USER 'postgres',
    PASSWORD 'monkey'
);

-- Install required extensions
INSTALL ducklake;
INSTALL postgres;
INSTALL httpfs;
```

**Note**: Replace the credentials with your actual MinIO API key/secret and PostgreSQL connection details.

### Attach DuckLake Catalog

```sql
ATTACH 'ducklake:postgres:dbname=ducklake' AS ducklake(DATA_PATH 's3://ducklake');
USE ducklake;

-- Set compression options for optimal storage
CALL set_option('parquet_compression', 'zstd');
CALL set_option('parquet_compression_level', '19');
FROM options();
```

---

## 🧠 Understanding the Architecture

### The ATTACH Command Explained

The `ATTACH 'ducklake:postgres:dbname=ducklake' AS ducklake(DATA_PATH 's3://ducklake');` command has several components:

**🔹 ATTACH**

DuckDB can "attach" external databases for unified querying. Here we're attaching a DuckLake catalog that provides lakehouse functionality.

**🔹 'ducklake:postgres:dbname=ducklake'**

This connection string has three parts:

* `ducklake:` - Uses the DuckLake extension (not local DuckDB files)
* `postgres:` - Backend catalog driver storing metadata in PostgreSQL  
* `dbname=ducklake` - Connects to the PostgreSQL database named "ducklake"

**🔹 AS ducklake**

Creates a schema alias in DuckDB. Query tables with `ducklake.table_name` or use `USE ducklake;` to set as default.

**🔹 (DATA_PATH 's3://ducklake')**

Tells DuckLake where to store actual table data (Parquet files) in your MinIO bucket.

### Data Storage Architecture

* **Metadata** (schemas, table definitions) → PostgreSQL database
* **Data files** (Parquet) → MinIO object storage (s3://ducklake bucket)
* **Query engine** → DuckDB with DuckLake lakehouse features

---

## 🧪 Testing the Setup

### 1. Verify Secrets

Confirm the secrets were created:

```sql
SELECT name FROM duckdb_secrets();
```

Expected (at minimum): `__default_s3`, `__default_postgres`.

### 2. Quick Environment Sanity

Check current options (compression, etc.):

```sql
FROM options();
```

### 3. Create Sample Tables

Create two simple tables and insert rows:

```sql
CREATE TABLE test (
    id INTEGER,
    data VARCHAR
);

INSERT INTO test VALUES (1, 'test data'), (2, 'more test data');

CREATE TABLE test2 (
    id INTEGER,
    date VARCHAR
);

INSERT INTO test2 VALUES (1, '2023-01-01'), (2, '2023-01-02');
```

### 4. Basic Reads & Join

```sql
SELECT * FROM test;
SELECT * FROM test2;

-- Join across lakehouse tables
SELECT *
FROM test
LEFT JOIN test2 USING (id);
```

### 5. Verify Parquet Files Written

List generated Parquet objects in the MinIO bucket:

```sql
SELECT * FROM glob('s3://ducklake/**/*.parquet');
```

If empty, ensure the bucket name matches and the S3 secret endpoint is reachable.

### 6. Optional: Row Count & Compression Check

```sql
SELECT COUNT(*) AS test_rows FROM test;
SELECT COUNT(*) AS test2_rows FROM test2;
```

To inspect Parquet metadata directly (example):

```sql
PRAGMA parquet_metadata('s3://ducklake/test/*.parquet');
```

---

### Troubleshooting Quick Reference

| Symptom            | Check                                      | Fix                                            |
| ------------------ | ------------------------------------------ | ---------------------------------------------- |
| Secrets missing    | `SELECT * FROM duckdb_secrets();`          | Re-run CREATE SECRET statements                |
| No Parquet files   | `glob('s3://ducklake/**/*.parquet')` empty | Confirm bucket exists & endpoint/credentials   |
| Join returns NULLs | Data mismatch                              | `SELECT * FROM test ORDER BY id;` validate IDs |
| Permissions error  | MinIO logs / access denied                 | Regenerate access key with proper policy       |

---

### Clean Up (Optional)

```sql
DROP TABLE test2; 
DROP TABLE test;
```

---

---

## 🏗️ Benefits of This Architecture

### Performance Advantages

* **Columnar storage**: Parquet format optimized for analytical queries
* **Compression**: ZSTD level 19 provides excellent compression ratios
* **Object storage**: Scales beyond local disk limitations
* **ZFS optimization**: Fast metadata operations and data integrity

### Operational Benefits

* **ACID transactions**: DuckLake provides database-like consistency
* **Schema evolution**: Modify table schemas without data migration
* **Backup simplicity**: Object storage with built-in replication
* **Cost efficiency**: Store cold data cheaply while keeping hot data accessible

### Query Flexibility

* **Standard SQL**: Full SQL support with DuckDB's rich feature set
* **Mixed workloads**: OLTP in PostgreSQL, OLAP in DuckLake
* **Data federation**: Query across multiple data sources seamlessly

---

## 🚨 Troubleshooting Common Issues

### Connection Problems

**MinIO not accessible:**

```bash
# Check service status
systemctl status minio.service

# Verify port binding
ss -tlnp | grep 9000

# Check firewall rules
ufw status
```

**PostgreSQL connection failed:**

```sql
-- Test PostgreSQL connection
SELECT version();
\l  -- List databases
```

**DuckLake attachment fails:**

```sql
-- Verify secrets are created
SELECT name FROM duckdb_secrets();

-- Check extension installation
SELECT extension_name FROM duckdb_extensions() WHERE loaded = true;
```

### Performance Tuning

**Optimize MinIO for your workload:**

```bash
# Adjust MinIO for high-throughput scenarios
export MINIO_API_REQUESTS_MAX=10000
export MINIO_API_REQUESTS_DEADLINE=10s
```

**PostgreSQL tuning for metadata:**

```sql
-- Optimize for metadata operations
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET random_page_cost = 1.1;
SELECT pg_reload_conf();
```

---

## 🎯 Next Steps

* **Monitoring**: Set up Prometheus metrics collection from MinIO
* **Security**: Implement proper authentication and encryption
* **Backup**: Configure automated backup strategies for both PostgreSQL and MinIO
* **Scaling**: Consider multi-node MinIO deployment for larger datasets

---

## 💡 Conclusion

This setup combines the best aspects of modern data architecture:

* **MinIO** provides scalable, S3-compatible object storage
* **PostgreSQL** offers robust metadata management and ACID compliance  
* **DuckLake** bridges the gap with lakehouse functionality
* **ZFS** ensures data integrity and optimal I/O performance

The result is a powerful, cost-effective data platform suitable for both analytical and transactional workloads.

---

*This post was enhanced with assistance from Claude.*
