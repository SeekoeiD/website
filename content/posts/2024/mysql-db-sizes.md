+++
title = 'MySQL: Database Size'
date = 2024-08-29T00:00:00+02:00
draft = false
tags = ['mysql', 'database', 'size']
+++

I always forget how to get the size of a MySql database. So here it is:

```sql
SELECT
     table_schema as `Database`,
     table_name AS `Table`,
     round(((data_length) / 1024 / 1024), 2) `data_length`,
     round(((index_length) / 1024 / 1024), 2) `index_length`,
     round(((data_length + index_length) / 1024 / 1024), 2) `total`
FROM information_schema.TABLES
ORDER BY (data_length + index_length) DESC;
```
