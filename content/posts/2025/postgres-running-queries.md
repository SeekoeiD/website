+++
title = 'View Postgres Running Queries'
date = 2025-09-04T14:01:27+02:00
draft = false
+++

When managing PostgreSQL databases, monitoring running queries is essential for performance tuning and troubleshooting. PostgreSQL provides several built-in views and tools to help you understand what queries are currently executing and how long they've been running.

## Basic Query to View Running Queries

Here's a simple query to see currently active queries:

```sql
SELECT age(clock_timestamp(), query_start), state, query 
FROM pg_stat_activity 
WHERE state='active'
ORDER BY query_start desc;
```

## Understanding pg_stat_activity

The `pg_stat_activity` view is your primary tool for monitoring database activity. It provides real-time information about all current database connections and their activities. Here are the key columns you can use:

### Essential Columns

- **`pid`** - Process ID of the backend process
- **`usename`** - Name of the user logged into the backend
- **`application_name`** - Name of the application connected to the backend
- **`client_addr`** - IP address of the client connected to the backend
- **`state`** - Current overall state of the backend (active, idle, idle in transaction, etc.)
- **`query_start`** - Time when the currently active query was started
- **`query`** - Text of the backend's most recent query

### Timing Information

- **`backend_start`** - Time when this process was started
- **`xact_start`** - Time when the current transaction was started
- **`state_change`** - Time when the state was last changed

## Enhanced Queries for Monitoring

### Long-Running Queries

To find queries that have been running for more than a specific duration:

```sql
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    age(clock_timestamp(), query_start) as duration,
    state,
    LEFT(query, 100) as query_preview
FROM pg_stat_activity 
WHERE state = 'active' 
  AND query_start < clock_timestamp() - interval '5 minutes'
ORDER BY query_start;
```

### Detailed Query Information

For a more comprehensive view including transaction information:

```sql
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    backend_start,
    xact_start,
    query_start,
    state_change,
    age(clock_timestamp(), query_start) as query_duration,
    age(clock_timestamp(), xact_start) as transaction_duration,
    state,
    wait_event_type,
    wait_event,
    query
FROM pg_stat_activity 
WHERE state != 'idle'
ORDER BY query_start;
```

### Blocking Queries

To identify queries that might be blocking others:

```sql
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS blocking_statement,
    age(clock_timestamp(), blocked_activity.query_start) AS blocked_duration
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity 
    ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity 
    ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

## Alternative Monitoring Methods

### 1. pg_stat_statements Extension

The `pg_stat_statements` extension provides query execution statistics:

```sql
-- Enable the extension (requires superuser)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View query statistics
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    stddev_time,
    rows
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;
```

### 2. Log-Based Monitoring

Configure PostgreSQL to log slow queries by setting these parameters in `postgresql.conf`:

```conf
log_min_duration_statement = 1000  # Log queries longer than 1 second
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
```

### 3. Using EXPLAIN ANALYZE

For detailed execution plans and timing of specific queries:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) 
SELECT * FROM your_table WHERE your_condition;
```

## Terminating Long-Running Queries

If you need to terminate a problematic query:

```sql
-- Gracefully terminate a query
SELECT pg_cancel_backend(pid);

-- Forcefully terminate a connection (use with caution)
SELECT pg_terminate_backend(pid);
```

## Best Practices

1. **Regular Monitoring**: Set up automated monitoring to alert on long-running queries
2. **Index Optimization**: Use the information from `pg_stat_activity` to identify queries that might benefit from indexing
3. **Connection Pooling**: Monitor connection counts to ensure your application isn't creating too many connections
4. **Query Analysis**: Regularly analyze slow queries using `EXPLAIN ANALYZE`

## Conclusion

PostgreSQL's `pg_stat_activity` view is a powerful tool for real-time database monitoring. Combined with other monitoring techniques like `pg_stat_statements` and proper logging configuration, you can maintain excellent visibility into your database performance and quickly identify issues before they impact your applications.

---

*This post was enhanced with assistance from Claude.*
