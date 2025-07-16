+++
title = 'New Postgres Install'
date = 2025-07-16T09:50:51+02:00
draft = false
tags = ['postgres', 'ubuntu']
+++

Great — you're setting up a PostgreSQL server where:

* The OS disk is **small**, so you don't want to store database files there.
* You want to install **PostgreSQL in default system locations** (e.g., `/etc`, `/usr`, systemd, etc.).
* You have a **ZFS pool mounted at `/pool`**, which you want to hold *all PostgreSQL data* by default.
* Your goal is to have **all tables, WAL, indexes, etc. go to `/pool`**, despite using default installation paths.

This is a common scenario in production setups. Below is a **clean, robust setup strategy**.

---

## ✅ Strategy Summary

1. **Install PostgreSQL normally** (from package or source)
2. **Create the data directory inside your ZFS pool** (e.g., `/pool/pgdata`)
3. **Initialize the cluster with that directory**
4. **Use `systemd` or PostgreSQL config to point the server to that location**
5. (Optional) Use tablespaces in subdirectories if you want future flexibility

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

### 2. **Create a New Data Directory in `/pool`**

```bash
sudo mkdir -p /pool/pgdata
sudo chown postgres:postgres /pool/pgdata
sudo chmod 700 /pool/pgdata
```

---

### 3. **Initialize the PostgreSQL Cluster**

Stop the default service first if it's running:

```bash
sudo systemctl stop postgresql
```

Then initialize manually:

```bash
sudo -u postgres /usr/lib/postgresql/16/bin/initdb -D /pool/pgdata
```

(Adjust path for your installed version, e.g. `15` or `16`.)

---

### 4. **Point PostgreSQL to Use /pool/pgdata**

#### Option A: Edit the systemd service

Edit the systemd unit override:

```bash
sudo systemctl edit postgresql@16-main
```

Add this:

```ini
[Service]
Environment=PGDATA=/pool/pgdata
```

Then reload and start:

```bash
sudo systemctl daemon-reexec
sudo systemctl daemon-reload
sudo systemctl restart postgresql@16-main
```

#### Option B: Modify `pg_ctlcluster` (not recommended for most)

You can also change `/etc/postgresql/16/main/postgresql.conf` and update:

```conf
data_directory = '/pool/pgdata'
```

And change `/etc/postgresql/16/main/start.conf` to:

```text
manual
```

But Option A is cleaner and systemd-native.

---

### 5. **Confirm the Server is Using the Correct Data Directory**

```bash
psql -U postgres -c 'SHOW data_directory;'
```

It should return:

```
/pool/pgdata
```

---

## 🧠 Bonus Tips

* **WAL files** will also go under `/pool/pgdata/pg_wal`
* **You don’t need tablespaces** unless you want to spread data over multiple paths/pools — everything now defaults to `/pool`
* If your ZFS pool supports compression or deduplication, PostgreSQL will benefit automatically

---

## 📘 Final Directory Layout

```bash
/pool/pgdata/
├── base/             ← main table storage
├── pg_wal/           ← write-ahead logs
├── global/
├── pg_xact/
├── postgresql.conf
└── ...
```

---

\* Credit ChatGPT
