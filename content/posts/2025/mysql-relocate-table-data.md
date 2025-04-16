+++
title = 'MySQL: Relocate Table Data'
date = 2025-04-01T00:00:00+02:00
draft = false
tags = ['mysql', 'database']
+++

I'm running various MySQL databases on one server. The disk for the operating system is a nothing-fancy 500 GB SATA SSD. If you create a new database and create tables they will all be put at `/var/lib/mysql/{databse name}/{table name}`. I needed to spread out my table data and put them on fast NVMe storage.

Edit your MySQL configuration:

```bash
nano /etc/mysql/mysql.conf.d/mysqld.cnf
```

List the directories where your data will be stored. I'll put all my data in a `mysql-data` directory on each of my disks. When you create a table and specify its data directory, MySQL will create a sub-directory `{database name}` in `mysql-data` and the the `{table name}.idb` file inside.

```text
innodb_directories="/nvme1/mysql-data;/nvme2/mysql-data;/ssd1/mysql-data;/ssd2/mysql-data"
```

You will have to restart MySQL:

```bash
systemctl restart mysql
```

Next, create the `mysql-data` directories on each of your disks and give them the correct permissions:

```bash
mkdir -p /nvme1/mysql-data
chown -R mysql:mysql /nvme1/mysql-data
chmod 750 /nvme1/mysql-data
```

To create your tables and specify there data locations:

```sql
CREATE TABLE `labels` (
    `location` varchar(255) NOT NULL,
    `label` varchar(255) NOT NULL,
    PRIMARY KEY (`location`)
) ENGINE = InnoDB DATA DIRECTORY = '/nvme1/mysql-data/';
```

If your `mysql-data` directories does not exist or have the wrong permissions, the `CREATE TABLE` query will give an error like `ERROR 1030 (HY000): Got error 168 - 'Unknown (generic) error from engine' from storage engine`. You can get ore detail about it in MySQL's error logs:

```bash
tail /var/log/mysql/error.log

2025-03-30T13:56:20.405948Z 8 [ERROR] [MY-012592] [InnoDB] Operating system error number 13 in a file operation.
2025-03-30T13:56:20.406002Z 8 [ERROR] [MY-012595] [InnoDB] The error means mysqld does not have the access rights to the directory.
```

I also had to disable AppArmor on Ubuntu 24.04.

References:

-   <https://dev.mysql.com/doc/refman/8.4/en/create-table.html>
-   <https://dev.mysql.com/doc/refman/8.4/en/innodb-create-table-external.html>
-   <https://dev.mysql.com/doc/refman/8.4/en/innodb-parameters.html#sysvar_innodb_directories>
