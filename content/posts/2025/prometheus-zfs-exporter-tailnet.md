+++
title = 'Prometheus ZFS Exporter on Tailnet'
date = 2025-07-25T08:13:21+02:00
draft = false
tags = ['tailscale', 'prometheus', 'ubuntu']
+++

When monitoring ZFS storage systems with Prometheus, protecting sensitive filesystem metrics is crucial. ZFS Exporter provides detailed pool health, dataset statistics, and performance metrics that should never be exposed to the public internet. This guide demonstrates how to configure ZFS Exporter to be accessible only through your Tailscale network (tailnet).

## The Security Challenge

By default, ZFS Exporter listens on port 9134 and serves comprehensive ZFS metrics to any client that can reach that port. This creates significant security risks:

- **Storage intelligence leak**: ZFS metrics reveal pool layouts, capacity planning, and usage patterns
- **Performance data exposure**: I/O statistics and bottlenecks become visible to attackers
- **Infrastructure mapping**: Dataset names and structures expose organizational data
- **Compliance violations**: Storage metrics often contain sensitive operational information

## Our Solution: Tailnet-Only Access

- All ZFS servers are on the same tailnet
- zfs_exporter should be accessible only via tailnet
- zfs_exporter should not be accessible from the public internet

This approach provides:

- **Zero-trust networking**: Only authenticated devices on your tailnet can access ZFS metrics
- **Encrypted traffic**: All communication goes through Tailscale's encrypted tunnels
- **Simplified firewall rules**: Clear allow/deny rules based on Tailscale's IP range
- **Storage security**: Critical filesystem data remains private

## Prerequisites

Before proceeding, ensure:

- ZFS is installed and configured on your Ubuntu system
- Tailscale is installed and your server is connected to your tailnet
- You have root access for installation and firewall configuration

## The Installation Script

Here's our complete setup script that handles installation, service configuration, and firewall rules:

```bash
#!/bin/bash
set -e

# Define version
VERSION="2.3.8"

echo "[*] Installing zfs_exporter v$VERSION..."

# Download and install zfs_exporter
cd /tmp
wget -q https://github.com/pdf/zfs_exporter/releases/download/v$VERSION/zfs_exporter-$VERSION.linux-amd64.tar.gz
tar xfz zfs_exporter-$VERSION.linux-amd64.tar.gz
cp zfs_exporter-$VERSION.linux-amd64/zfs_exporter /usr/local/bin/
chmod +x /usr/local/bin/zfs_exporter

echo "[*] Creating systemd service..."

cat <<EOF | tee /etc/systemd/system/zfs_exporter.service
[Unit]
Description=ZFS Exporter
Wants=network-online.target
After=network-online.target

[Service]
User=root
Group=root
Type=simple
ExecStart=/usr/local/bin/zfs_exporter

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reexec
systemctl daemon-reload
systemctl enable zfs_exporter
systemctl start zfs_exporter

echo "[*] Configuring UFW..."

# Allow SSH explicitly (precaution)
ufw allow OpenSSH comment "Allow SSH"

# Set default policies
ufw default allow incoming
ufw default allow outgoing

# Block zfs_exporter from everywhere EXCEPT Tailnet
ufw allow from 100.0.0.0/8 to any port 9134 comment "Allow zfs_exporter from Tailnet"
ufw deny 9134 comment "Block zfs_exporter from outside Tailnet"

# Enable UFW if inactive
if ufw status | grep -q "Status: inactive"; then
  echo "[*] Enabling UFW firewall with default allow policy..."
  echo "y" | ufw enable
else
  echo "[*] UFW already active."
fi

ufw reload

echo "[✓] Final UFW status:"
ufw status verbose

echo "[✓] zfs_exporter service status:"
systemctl status zfs_exporter --no-pager
```

## Key Security Features

### 1. Tailscale IP Range Restriction

The script uses `100.0.0.0/8` which is Tailscale's reserved IP range. This ensures only devices authenticated to your tailnet can access the ZFS metrics.

### 2. Explicit Deny Rule

The `ufw deny 9134` rule provides defense-in-depth by explicitly blocking external access to the ZFS Exporter port.

### 3. SSH Protection

The script preserves SSH access as a safety measure, preventing you from locking yourself out during firewall configuration.

### 4. Root Permissions

ZFS Exporter runs as root to access ZFS kernel modules and gather comprehensive pool statistics.

## Verification Steps

After running the script, verify your setup:

### Check ZFS Exporter Status

```bash
systemctl status zfs_exporter
```

### Verify Firewall Rules

```bash
ufw status verbose
```

You should see rules similar to:

```text
9134       ALLOW    100.0.0.0/8       # Allow zfs_exporter from Tailnet
9134       DENY     Anywhere          # Block zfs_exporter from outside Tailnet
```

### Test Access

From another machine on your tailnet:

```bash
curl http://[TAILSCALE_IP]:9134/metrics
```

From outside the tailnet, this should fail or timeout.

### Verify ZFS Metrics

Check that ZFS metrics are being exported correctly:

```bash
curl -s http://localhost:9134/metrics | grep zfs_pool
```

You should see metrics like:

```text
zfs_pool_allocated_bytes{pool="tank"} 1.23456789e+12
zfs_pool_size_bytes{pool="tank"} 2.34567890e+12
zfs_pool_free_bytes{pool="tank"} 1.11111111e+12
```

## Available ZFS Metrics

ZFS Exporter provides comprehensive metrics including:

- **Pool Health**: Status, errors, and resilience information
- **Capacity Metrics**: Used, free, and total space per pool and dataset
- **Performance Stats**: I/O operations, bandwidth, and latency
- **Dataset Information**: Compression ratios, deduplication stats
- **Error Counters**: Read, write, and checksum errors
- **Scrub Status**: Last scrub time and error counts

## Prometheus Configuration

Configure your Prometheus server to scrape ZFS metrics using Tailscale IPs:

```yaml
scrape_configs:
  - job_name: 'zfs_exporter_tailnet'
    file_sd_configs:
      - files:
          - '/etc/prometheus/targets/zfs_exporter.json'
        refresh_interval: 30s
    scrape_interval: 30s
    scrape_timeout: 10s
```

Create the `/etc/prometheus/targets/zfs_exporter.json` file with your ZFS servers:

```json
[
  {
    "targets": ["storage1:9134"],
    "labels": {
      "instance": "storage1",
      "datacenter": "home"
    }
  },
  {
    "targets": ["storage2:9134"],
    "labels": {
      "instance": "storage2",
      "datacenter": "home"
    }
  },
  {
    "targets": ["backup-server:9134"],
    "labels": {
      "instance": "backup-server",
      "datacenter": "home"
    }
  }
]
```

## Useful Grafana Queries

Here are some essential PromQL queries for monitoring ZFS:

### Pool Capacity

```promql
(zfs_pool_allocated_bytes / zfs_pool_size_bytes) * 100
```

### Pool Health Status

```promql
zfs_pool_health_status
```

### I/O Operations Rate

```promql
rate(zfs_pool_io_operations_total[5m])
```

### Error Rate

```promql
rate(zfs_pool_errors_total[5m])
```

## Troubleshooting

### Can't Access Metrics

1. Verify Tailscale is running on both machines
2. Check firewall rules with `ufw status`
3. Confirm ZFS Exporter is listening: `ss -tlnp | grep 9134`
4. Ensure ZFS is properly loaded: `lsmod | grep zfs`

### No ZFS Metrics

1. Check if ZFS pools exist: `zpool list`
2. Verify ZFS kernel modules: `modprobe zfs`
3. Check ZFS Exporter logs: `journalctl -u zfs_exporter -f`

### Permission Issues

ZFS Exporter requires root permissions to access ZFS statistics. If running as non-root:

```bash
# Add user to appropriate groups (not recommended for security)
usermod -a -G sudo prometheus
```

### Firewall Issues

If you need to reset UFW rules:

```bash
ufw --force reset
```

Then re-run the configuration portion of the script.

## Monitoring Best Practices

### Alert Rules

Consider these Prometheus alert rules for ZFS monitoring:

```yaml
groups:
  - name: zfs.rules
    rules:
      - alert: ZpoolUnhealthy
        expr: zfs_pool_health > 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "ZFS pool on {{ $labels.instance }} is not healthy ({{ $labels.name }})"
          description: "Zpool {{ $labels.name }} is in an unhealthy state. Check `zpool status`."
      - alert: ZpoolReadOnly
        expr: zfs_pool_read_only > 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "ZFS pool on {{ $labels.instance }} is in read-only mode ({{ $labels.name }})"
          description: "Zpool {{ $labels.name }} is in an unhealthy state. Check `zpool status`."
```

### Regular Monitoring

- Monitor pool capacity trends
- Set up alerts for degraded pools
- Track scrub completion and error rates
- Monitor I/O performance metrics

## Conclusion

This setup provides a secure, comprehensive way to monitor your ZFS storage infrastructure with Prometheus while keeping sensitive filesystem metrics away from the public internet. The combination of Tailscale's zero-trust networking and properly configured firewall rules ensures your storage monitoring data remains private and secure.

ZFS Exporter on a tailnet gives you peace of mind that your storage metrics are protected while still providing the detailed monitoring capabilities needed for proper storage management.

---

*This post was enhanced with assistance from Claude.*
