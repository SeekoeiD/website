+++
title = 'Running Multiple MySQL Daemons on the Same Server'
date = 2025-05-06T00:00:00+02:00
draft = false
tags = ['mysql', 'unix', 'linux', 'ubuntu']
+++

I have multiple, write-heavy databases on a single server. I have MySQL installed in the default `/var/lib/mysql` directory, but create my table `.idb` files on other drives. See my post on relocating MySQL data files for more [information](https://danieldutoit.net/posts/2025/mysql-relocate-table-data/).

I require more throughput on one DB than the others, so I put its table files on NVMe disks. The others are on slow SATA disks. InnoDB uses shared background threads to flush dirty pages (modified memory pages) and log files to disk. These include*:

- innodb_buffer_pool (memory holding table/index pages)
- redo logs (changes not yet written to disk)
- doublewrite buffer (optional, for crash safety)

If you have tables split across fast (NVMe) and slow (SATA SSD) devices:

- InnoDB does not prioritize per-device flushing
- Flushing to a slow SATA device may block or slow down global flushing threads
- As a result, even tables on NVMe must wait if flushing queues are congested

To avoid this, I run multiple MySQL daemons on the same server. Each daemon has its own configuration file and data directory. This allows me to configure each daemon independently, including the buffer pool size, log file size, and flushing behavior.

I'll keep my default MySQL daemon and add an `NVMe` and `SATA` daemon. I'll still keep my tables where they currently are, but they'll be handled by different daemons.

Create the daemon storage locations (like `/var/lib/mysql`):

```bash
mkdir -p /nvme2/mysqld
mkdir -p /ssd2/mysqld
chown -R mysql:mysql /nvme2/mysqld /ssd2/mysqld

mysqld --initialize --datadir=/nvme2/mysqld
mysqld --initialize --datadir=/ssd2/mysqld
```

Create configuration files for each daemon (like `/etc/mysql/mysql.conf.d/mysqld.cnf`):

```ini
[mysqld]
user = mysql
pid-file = /var/run/mysqld/nvme.pid
socket = /var/run/mysqld/nvme.sock
port = 3307
datadir = /nvme2/mysql

bind-address = 0.0.0.0
mysqlx-bind-address = 127.0.0.1
key_buffer_size = 16M
myisam-recover-options  = BACKUP
log_error = /nvme2/mysql/error.log
max_binlog_size   = 100M

# Binary Logging (Disabled for write performance)
skip-log-bin = 1

# InnoDB Memory & Redo Log Settings
innodb_buffer_pool_size = 48G
innodb_buffer_pool_instances = 8
innodb_redo_log_capacity = 8G
innodb_log_buffer_size = 512M

# Flush settings for performance
innodb_flush_log_at_trx_commit = 2
innodb_flush_method = O_DIRECT
innodb_flush_neighbors = 0

# NVMe-optimized I/O settings
innodb_io_capacity = 4000
innodb_io_capacity_max = 8000

# Threading
innodb_read_io_threads = 8
innodb_write_io_threads = 8
innodb_purge_threads = 4
innodb_page_cleaners = 4

# Other InnoDB
innodb_file_per_table = 1
innodb_max_dirty_pages_pct = 80
innodb_max_dirty_pages_pct_lwm = 60

# Temp table & cache
tmp_table_size = 256M
max_heap_table_size = 256M
table_open_cache = 4096
table_definition_cache = 4096

# Concurrency
max_connections = 4096

# Adaptive Hash (optional for mixed workloads)
innodb_adaptive_hash_index = ON
innodb_adaptive_hash_index_parts = 8

innodb_directories="/nvme1/mysql-data;/nvme2/mysql-data;/ssd1/mysql-data;/ssd2/mysql-data"
```

The most important settings are:

```ini
user = mysql
pid-file = /var/run/mysqld/nvme.pid
socket = /var/run/mysqld/nvme.sock
port = 3307
datadir = /nvme2/mysql
```

Because we ran `mysqld --initialize` the root password was given a temporary password. You can find it in the error log file: `grep 'temporary password' /var/log/mysql/error.log`. Connect to your new daemon with `mysql --socket=/var/run/mysqld/nvme.sock -u root -p` and the temporary password.

You will have to change the password to something more permanent. You can do this with the `ALTER USER` command:

```sql
ALTER USER 'root'@'localhost' IDENTIFIED BY 'password';
CREATE USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'password';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
```

We can run these new daemons as services. Create a new service file for each daemon in `/etc/systemd/system/mysql-nvme.service` and `/etc/systemd/system/mysql-sata.service`:

```ini
[Unit]
Description=MySQL NVMe Instance
After=network.target

[Service]
User=mysql
Group=mysql
ExecStart=/usr/sbin/mysqld --defaults-file=/nvme2/mysqld.cnf
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Then run the following commands to start the new daemons:

```bash
systemctl daemon-reload
systemctl start mysql-nvme
systemctl enable mysql-nvme
```

Check the status of all daemons with:

```bash
systemctl status mysql*
```

\* Credit ChatGPT
