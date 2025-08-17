+++
title = 'New Postgres Install'
date = 2025-07-16T09:50:51+02:00
draft = false
tags = ['postgres', 'ubuntu']
+++

Great — you're setting up a PostgreSQL server where:

* The OS disk is **small**, so you don't want to store database files there.
* You want to install **PostgreSQL in default system ## 🧠 Bonus Tips

* **WAL files** are now stored in `/pool/pg_wal` on a separate optimized ZFS dataset
* **Main data files** are in `/pool/pgdata` with settings optimized for mixed workloads
* **You don't need tablespaces** unless you want to spread data over multiple pools — everything now defaults to the optimized ZFS datasets
* ZFS compression and other optimizations benefit PostgreSQL automatically
* The separate WAL dataset provides better I/O isolation and performance tuning

## 💾 Final Directory Structure

```bash
/pool/pgdata/             ← Main data directory (on pool/pgdata dataset)
├── base/                 ← table storage
├── global/               ← cluster-wide tables
├── pg_xact/             ← transaction status
├── postgresql.conf       ← main config
├── pg_hba.conf          ← authentication config
└── pg_wal -> /pool/pg_wal  ← symlink to WAL directory

/pool/pg_wal/             ← WAL directory (on pool/pg_wal dataset)
├── 000000010000000000000001
├── 000000010000000000000002
└── ...                   ← Write-Ahead Log files
```

* You have a **ZFS pool with optimized datasets** for PostgreSQL data and WAL files.
* Your goal is to have **all tables, WAL, indexes, etc. go to separate optimized ZFS datasets**.
* With the authentication setup, any logged-in user can connect to PostgreSQL using the postgres database user
* Remote connections are secured with password authentication

This is a common scenario in production setups. Below is a **clean, robust setup strategy**.

## ✅ Strategy Summary

1. **Create optimized ZFS datasets** for PostgreSQL data and WAL files
2. **Install PostgreSQL normally** (from package or source)
3. **Initialize the cluster with separate data and WAL directories**
4. **Use `systemd` or PostgreSQL config to point the server to those locations**
5. **Configure authentication for local and remote access**
6. (Optional) Use tablespaces in subdirectories if you want future flexibility

---

## 🗄️ ZFS Dataset Setup

Before installing PostgreSQL, create optimized ZFS datasets for the database:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Create the RAIDZ2 pool on your 5 NVMe devices
zpool create -o ashift=12 -o autotrim=on -o autoexpand=on \
  pool raidz2 /dev/nvme0n1 /dev/nvme1n1 /dev/nvme2n1 /dev/nvme3n1 /dev/nvme6n1

# Create Postgres datasets
zfs create pool/pgdata
zfs create pool/pg_wal

# pgdata (tables + indexes): mixed workload friendly
zfs set compression=zstd-3 pool/pgdata
zfs set atime=off pool/pgdata
zfs set xattr=sa pool/pgdata
zfs set redundant_metadata=most pool/pgdata
zfs set recordsize=128K pool/pgdata
zfs set logbias=latency pool/pgdata

# pg_wal (sequential journal)
zfs set compression=lz4 pool/pg_wal
zfs set atime=off pool/pg_wal
zfs set xattr=sa pool/pg_wal
zfs set recordsize=128K pool/pg_wal
zfs set logbias=latency pool/pg_wal
```

### Dataset Optimization Explained

**For `pool/pgdata` (main database files):**

* `compression=zstd-3`: Better compression for mixed data types
* `recordsize=128K`: Optimal for PostgreSQL's default page size and larger reads
* `logbias=latency`: Prioritize low latency over throughput
* `redundant_metadata=most`: Extra metadata protection for critical data

**For `pool/pg_wal` (Write-Ahead Log):**

* `compression=lz4`: Fast compression for sequential writes
* `recordsize=128K`: Matches PostgreSQL WAL segment size
* `logbias=latency`: Critical for transaction performance

---

## 🛠️ Step-by-Step Guide

### 1. **Install PostgreSQL (Default System Paths)**

On Ubuntu:

```bash
sudo apt update
sudo apt install postgresql
```

This installs:

* Binaries to `/usr/bin/`
* Configs to `/etc/postgresql/`
* Default data dir (which we’ll override)
* Service as `postgresql@<version>.service`

---

### 2. **Set Up Directory Permissions**

Set proper ownership and permissions for the ZFS datasets:

```bash
sudo chown postgres:postgres /pool/pgdata
sudo chown postgres:postgres /pool/pg_wal
sudo chmod 700 /pool/pgdata
sudo chmod 700 /pool/pg_wal
```

---

### 3. **Initialize the PostgreSQL Database with Separate WAL Directory**

Stop any default services first:

```bash
sudo systemctl stop postgresql
sudo systemctl disable postgresql
```

Initialize your database with separate data and WAL directories:

```bash
sudo -u postgres /usr/lib/postgresql/16/bin/initdb -D /pool/pgdata -X /pool/pg_wal
```

The `-X` flag tells PostgreSQL to use `/pool/pg_wal` for the Write-Ahead Log files, which will be on our optimized ZFS dataset.

(Adjust path for your installed version, e.g. `15` or `16`.)

---

### 4. **Create a Simple Systemd Service**

Instead of using Ubuntu's cluster system, create a simple custom service:

```bash
sudo tee /etc/systemd/system/postgresql.service > /dev/null <<EOF
[Unit]
Description=PostgreSQL database server
Documentation=man:postgres(1)
After=network-online.target
Wants=network-online.target

[Service]
Type=notify
User=postgres
ExecStart=/usr/lib/postgresql/16/bin/postgres -D /pool/pgdata
ExecReload=/bin/kill -HUP \$MAINPID
KillMode=mixed
KillSignal=SIGINT
TimeoutSec=infinity

[Install]
WantedBy=multi-user.target
EOF
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

Now you can use simple commands:

* `sudo systemctl start postgresql`
* `sudo systemctl stop postgresql`
* `sudo systemctl restart postgresql`
* `sudo systemctl status postgresql`

---

### 5. **Configure Authentication and Set PostgreSQL Password**

Set the password for the postgres database user:

```bash
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'my_password';"
```

Configure authentication in `/pool/pgdata/pg_hba.conf` to allow:

* Any logged-in user to use CLI with postgres db user
* Remote connections with password

```bash
sudo -u postgres tee /pool/pgdata/pg_hba.conf > /dev/null <<EOF
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Allow local connections without password for all users to connect as postgres
local   all             postgres                                trust
local   all             all                                     peer

# IPv4 remote connections with password
host    all             postgres        0.0.0.0/0               md5
host    all             all             0.0.0.0/0               md5

# IPv6 remote connections with password  
host    all             postgres        ::/0                    md5
host    all             all             ::/0                    md5
EOF
```

Enable remote connections by editing the main config:

```bash
sudo -u postgres sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /pool/pgdata/postgresql.conf
```

---

### 6. **Confirm the Server is Using the Correct Data Directory**

```bash
psql -U postgres -c 'SHOW data_directory;'
```

It should return:

```bash
/pool/pgdata
```

---

## 🚨 Troubleshooting Common Issues

### Problem: "Peer authentication failed" or configs not taking effect

If you're getting authentication errors, here's how to fix it:

1. **Check which data directory PostgreSQL is actually using:**

```bash
sudo systemctl status postgresql
```

Look for the data directory path in the service status.

1. **Check if PostgreSQL is reading your configs:**

```bash
sudo -u postgres psql -c "SHOW config_file;"
sudo -u postgres psql -c "SHOW hba_file;"
sudo -u postgres psql -c "SHOW data_directory;"
```

These should all point to `/pool/pgdata/` paths.

1. **If still having issues, try the manual approach:**

```bash
# Stop the service
sudo systemctl stop postgresql

# Start manually to test
sudo -u postgres /usr/lib/postgresql/16/bin/postgres -D /pool/pgdata

# In another terminal, test connection
sudo -u postgres psql
```

### Authentication Solutions

For connecting as any logged-in user:

```bash
# Any user can now connect using:
psql -U postgres -h localhost
# Password: my_password (when prompted)

# Or for local socket connections:
sudo -u postgres psql
```

For the "role 'root' does not exist" error:

```bash
# Connect as postgres user and create your user
sudo -u postgres psql
CREATE USER root WITH SUPERUSER;
ALTER USER root WITH PASSWORD 'my_password';
\q
```

For peer authentication issues, ensure your `/pool/pgdata/pg_hba.conf` has:

```conf
# Allow local connections without password for postgres user
local   all             postgres                                trust
# Allow local peer connections for all users
local   all             all                                     peer
# Allow remote connections with password
host    all             postgres        0.0.0.0/0               md5
host    all             all             0.0.0.0/0               md5
```

Then reload the config:

```bash
sudo -u postgres psql -c "SELECT pg_reload_conf();"
```

---

## 🧠 Bonus Tips

* **You don’t need tablespaces** unless you want to spread data over multiple paths/pools — everything now defaults to `/pool`
* If your ZFS pool supports compression or deduplication, PostgreSQL will benefit automatically

---

\* Credit ChatGPT
