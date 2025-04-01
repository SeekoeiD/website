+++
title = 'MySQL: Write/Read Files'
date = 2024-09-07T00:00:00+02:00
draft = false
tags = ['mysql', 'database']
+++

Loading data into a MySQL table from a file is _much_ faster than inserting the data row by row. The same goes for exporting data from a table to a file. Here is how you can do it.

Export data from a table to a file:

```sql
SELECT *
INTO OUTFILE '/var/lib/mysql-files/data.csv'
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
FROM MyTable;
```

Note that we are exporting the data to `/var/lib/mysql-files/data.csv`. This is the default directory for MySQL to read and write files. If you want to export the data to another directory, you need to change the `secure_file_priv` setting in the MySQL configuration file.

Next, we can copy the file to another server using `scp`:

```bash
scp /var/lib/mysql-files/data.csv user@new-server:/var/lib/mysql-files/
```

On the new server, we need to fix the permissions on the file:

```bash
chown mysql:mysql /var/lib/mysql-files/data.csv
```

And then we can load the data into a table:

```sql
LOAD DATA INFILE '/var/lib/mysql-files/data.csv'
INTO TABLE MyTable
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n';
```
