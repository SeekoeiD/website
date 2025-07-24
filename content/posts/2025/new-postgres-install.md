+++
title = 'New Postgres Install'
date = 2025-07-16T09:50:51+02:00
draft = false
tags = ['postgres', 'ubuntu']
+++

Great — you're setting up a PostgreSQL server where:

* The OS disk is **small**, so you don't want to store database files there.
* You * **WAL files** will also go under `/pool/pgdata/pg_wal`
* **You don't need tablespaces** unless you want to spread data over multiple paths/volumes — everything now defaults to `/pool`
* With the authentication setup, any logged-in user can connect to PostgreSQL using the postgres database user
* Remote connections are secured with password authenticationt to install **PostgreSQL in default system locations** (e.g., `/etc`, `/usr`, systemd, etc.).
* You have a **fast storage mounted at `/pool`**, which you want to hold *all PostgreSQL data* by default.
* Your goal is to have **all tables, WAL, indexes, etc. go to `/pool`**, despite using default installation paths.

This is a common scenario in production setups. Below is a **clean, robust setup strategy**.

---

## ✅ Strategy Summary

1. **Install PostgreSQL normally** (from package or source)
2. **Create the data directory inside your fast storage** (e.g., `/pool/pgdata`)
3. **Initialize the cluster with that directory**
4. **Use `systemd` or PostgreSQL config to point the server to that location**
5. **Configure authentication for local and remote access**
6. (Optional) Use tablespaces in subdirectories if you want future flexibility

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

### 3. **Initialize the PostgreSQL Database**

Stop any default services first:

```bash
sudo systemctl stop postgresql
sudo systemctl disable postgresql
```

Initialize your database directly:

```bash
sudo -u postgres /usr/lib/postgresql/16/bin/initdb -D /pool/pgdata
```

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
- Any logged-in user to use CLI with postgres db user
- Remote connections with password

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

```
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

2. **Check if PostgreSQL is reading your configs:**

```bash
sudo -u postgres psql -c "SHOW config_file;"
sudo -u postgres psql -c "SHOW hba_file;"
sudo -u postgres psql -c "SHOW data_directory;"
```

These should all point to `/pool/pgdata/` paths.

3. **If still having issues, try the manual approach:**

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
├── pg_hba.conf       ← authentication config
└── ...
```

---

\* Credit ChatGPT
