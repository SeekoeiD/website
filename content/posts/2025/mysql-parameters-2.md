+++
title = 'MySQL: Configuration Parameters'
date = 2025-04-01T00:00:00+02:00
draft = false
tags = ['mysql', 'database']
+++

An update to my previous post on MySQL configuration parameters. This is for a server that has 64 GB RAM available for the MySQL database and hosts the table data on NVMe storage.

```bash
nano /etc/mysql/mysql.conf.d/mysqld.cnf
```

Add these settings at the end of the file:

```text
# Binary Logging (Disabled for write performance)
skip-log-bin = 1

# InnoDB Memory & Redo Log Settings
innodb_buffer_pool_size = 48G
innodb_buffer_pool_instances = 8

# Use this instead of deprecated innodb_log_file_size/log_files_in_group
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
```
