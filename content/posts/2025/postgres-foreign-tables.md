+++
title = 'PostgreSQL Foreign Tables: Accessing Data Across Schemas and Servers'
date = 2025-09-04T16:00:58+02:00
draft = false
mermaid = true
tags = ['postgres', 'database', 'fdw', 'foreign-tables']
+++

PostgreSQL Foreign Data Wrappers (FDW) allow you to access and query data from external sources as if they were local tables. In this post, I'll demonstrate how to set up foreign tables to access data from another schema, and show how this same technique can be used to connect to completely separate database servers.

## Architecture Overview

The diagram below shows our setup with two databases on the same PostgreSQL server. The key point is that while we're using databases on the same server here, the exact same approach works for connecting to completely separate database servers.

![PostgreSQL foreign table layout](/images/metal_price_data_integration.svg)

```text
PostgreSQL Server (localhost:5432)
├─ markets (database)
│  └─ prices (schema)
│     └─ metalprices (table) [timestamp, base, quote PKs, price]
└─ exchanges (database)
    └─ public (schema)
        ├─ candles (table) [datetime, exchange, base, quote, c, period]
        └─ metalprices_fdw (foreign table -> prices.metalprices)
```

> **Cross-Server Note**: To connect to a different PostgreSQL server, simply change the `host` parameter from `'localhost'` to the target server's IP address or hostname. The `markets` and `exchanges` could be on completely separate servers!

## Source Data: Metal Prices Table

First, let's look at our source table in the `prices` schema, which contains metal price data from [MetalPriceAPI](https://metalpriceapi.com/):

```sql
CREATE TABLE prices.metalprices (
    timestamp int8 NOT NULL,
    base varchar(12) NOT NULL,
    quote varchar(12) NOT NULL,
    price float8 NOT NULL,
    CONSTRAINT metalprices_pkey PRIMARY KEY (timestamp, base, quote)
);
```

This table stores timestamped metal prices with base and quote currencies.

## Setting Up the Foreign Data Wrapper

Now, let's set up a foreign table in the `exchanges` schema to access this data:

### 1. Enable the PostgreSQL FDW Extension

```sql
CREATE EXTENSION IF NOT EXISTS postgres_fdw;
```

### 2. Create a Foreign Server

```sql
CREATE SERVER markets_server 
FOREIGN DATA WRAPPER postgres_fdw 
OPTIONS (
    host 'localhost',    -- Could be a remote server IP/hostname
    dbname 'markets', 
    port '5432'
);
```

> **Cross-Server Usage**: To connect to a different server, simply change `host` to the target server's IP address or hostname.

### 3. Create User Mapping

```sql
CREATE USER MAPPING FOR current_user 
SERVER markets_server 
OPTIONS (
    user 'postgres', 
    password '00password00'
);
```

### 4. Create the Foreign Table

```sql
CREATE FOREIGN TABLE public.metalprices_fdw (
    timestamp int8 NOT NULL,
    base varchar(12) NOT NULL,
    quote varchar(12) NOT NULL,
    price float8 NOT NULL
) SERVER markets_server 
OPTIONS (
    schema_name 'prices', 
    table_name 'metalprices'
);
```

## Querying Across Schemas with Foreign Tables

Now we can query data from both schemas in a single query. Here's an example that joins cryptocurrency price data from the `exchanges` schema with ZAR exchange rates from the foreign table:

```sql
SELECT 
    to_timestamp(datetime) AS timestamp, 
    exchange, 
    base, 
    quote, 
    c AS usd_price, 
    price AS zar_usd, 
    (c/price) AS zar_price
FROM candles 
LEFT JOIN LATERAL (
    SELECT price
    FROM metalprices_fdw
    WHERE metalprices_fdw.timestamp <= candles.datetime 
      AND base='ZAR'
    ORDER BY metalprices_fdw.timestamp DESC
    LIMIT 1
) price ON true
WHERE exchange='kraken' 
  AND period=86400 
  AND base='XBT' 
  AND quote='USD' 
ORDER BY datetime DESC
LIMIT 10;
```

This query:

1. Gets Bitcoin (XBT) prices in USD from Kraken
2. Uses a lateral join to find the most recent ZAR exchange rate for each timestamp
3. Calculates the Bitcoin price in ZAR

## Sample Results

Here's the output showing Bitcoin prices converted to South African Rand:

| Date       | Exchange | Base | Quote | USD Price  | ZAR/USD  | ZAR Price (≈) |
| ---------- | -------- | ---- | ----- | ---------- | -------- | ------------- |
| 2025-09-01 | kraken   | XBT  | USD   | 109,250.00 | 0.056667 | 1,927,922     |
| 2025-08-31 | kraken   | XBT  | USD   | 108,250.00 | 0.056667 | 1,910,272     |
| 2025-08-30 | kraken   | XBT  | USD   | 108,750.00 | 0.056526 | 1,923,884     |
| 2025-08-29 | kraken   | XBT  | USD   | 108,400.10 | 0.056526 | 1,917,676     |
| 2025-08-28 | kraken   | XBT  | USD   | 112,563.70 | 0.056705 | 1,985,048     |

## Benefits and Use Cases

Foreign tables are particularly useful for:

- **Data federation**: Accessing data across multiple databases without ETL processes
- **Real-time reporting**: Querying live data from multiple sources
- **Microservices architecture**: Each service can maintain its own database while allowing controlled access to other services
- **Legacy system integration**: Connecting modern applications to older database systems

## Performance Considerations

- Foreign table queries can be slower than local table queries due to network overhead
- Consider indexing strategies on the source tables
- Use `EXPLAIN` to understand query execution plans
- For frequently accessed data, consider materialized views

Foreign Data Wrappers provide a powerful way to create a unified view of distributed data while maintaining clear separation of concerns between different schemas or database servers.

---

_This post was enhanced with assistance from Claude._
