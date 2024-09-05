+++
title = 'MySQL Parameters'
date = 2024-09-05
draft = false
tags = ['mysql', 'database', 'size']
+++

My goto settings for MySQL. This is for a server that has 8GB RAM available for the MySQL database.

```bash
nano /etc/mysql/mysql.conf.d/mysqld.cnf
```

Add these settings at the end of the file:

```text
skip-log-bin=true
innodb_buffer_pool_size = 7G
innodb_redo_log_capacity = 1G
innodb_log_buffer_size = 128M
innodb_flush_log_at_trx_commit = 2
innodb_flush_method = O_DIRECT
innodb_io_capacity = 1000
```
