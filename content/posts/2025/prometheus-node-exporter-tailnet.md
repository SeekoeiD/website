+++
title = 'Prometheus node_exporter on Tailnet'
date = 2025-07-24T13:32:50+02:00
draft = false
tags = ['tailscale', 'prometheus', 'ubuntu']
+++

# Securing Prometheus Node Exporter with Tailscale

When monitoring multiple servers with Prometheus, security should be a top priority. Node Exporter exposes detailed system metrics that you definitely don't want accessible from the public internet. This guide shows how to set up Node Exporter to be accessible only through your Tailscale network (tailnet).

## The Security Challenge

By default, Node Exporter listens on port 9100 and serves metrics to anyone who can reach that port. This creates a security risk:

- **Information disclosure**: System metrics reveal sensitive information about your infrastructure
- **Attack surface**: Additional open ports increase your attack surface
- **Compliance concerns**: Exposing internal metrics may violate security policies

## Our Solution: Tailnet-Only Access

- All servers are on the same tailnet
- node_exporter should be accessible only via tailnet
- node_exporter should not be accessible from the public internet

This approach provides:

- **Zero-trust networking**: Only devices on your tailnet can access metrics
- **Encrypted traffic**: All communication goes through Tailscale's encrypted tunnels
- **Simplified firewall rules**: Clear allow/deny rules based on Tailscale's IP range

## The Installation Script

Here's our complete setup script that handles installation, service configuration, and firewall rules:

```bash
#!/bin/bash
set -e

# Define version
VERSION="1.9.1"

echo "[*] Installing node_exporter v$VERSION..."

# Download and install node_exporter
cd /tmp
wget -q https://github.com/prometheus/node_exporter/releases/download/v$VERSION/node_exporter-$VERSION.linux-amd64.tar.gz
tar xfz node_exporter-$VERSION.linux-amd64.tar.gz
cp node_exporter-$VERSION.linux-amd64/node_exporter /usr/local/bin/
chmod +x /usr/local/bin/node_exporter

echo "[*] Creating systemd service..."

cat <<EOF | tee /etc/systemd/system/node_exporter.service
[Unit]
Description=Node Exporter
Wants=network-online.target
After=network-online.target

[Service]
User=root
Group=root
Type=simple
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reexec
systemctl daemon-reload
systemctl enable node_exporter
systemctl start node_exporter

echo "[*] Configuring UFW..."

# Allow SSH explicitly (precaution)
ufw allow OpenSSH comment "Allow SSH"

# Set default policies
ufw default allow incoming
ufw default allow outgoing

# Block node_exporter from everywhere EXCEPT Tailnet
ufw allow from 100.0.0.0/8 to any port 9100 comment "Allow node_exporter from Tailnet"
ufw deny 9100 comment "Block node_exporter from outside Tailnet"

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

echo "[✓] node_exporter service status:"
systemctl status node_exporter --no-pager
```

## Key Security Features

### 1. Tailscale IP Range Restriction
The script uses `100.0.0.0/8` which is Tailscale's reserved IP range. This ensures only devices authenticated to your tailnet can access the metrics.

### 2. Explicit Deny Rule
The `ufw deny 9100` rule provides defense-in-depth by explicitly blocking external access to the Node Exporter port.

### 3. SSH Protection
The script preserves SSH access as a safety measure, preventing you from locking yourself out during firewall configuration.

## Verification Steps

After running the script, verify your setup:

### Check Node Exporter Status
```bash
systemctl status node_exporter
```

### Verify Firewall Rules
```bash
ufw status verbose
```

You should see rules similar to:
```
9100       ALLOW    100.0.0.0/8       # Allow node_exporter from Tailnet
9100       DENY     Anywhere          # Block node_exporter from outside Tailnet
```

### Test Access
From another machine on your tailnet:
```bash
curl http://[TAILSCALE_IP]:9100/metrics
```

From outside the tailnet, this should fail or timeout.

## Prometheus Configuration

Configure your Prometheus server to scrape metrics using Tailscale IPs:

```yaml
scrape_configs:
  - job_name: 'node_exporter_tailnet'
    file_sd_configs:
      - files:
          - '/etc/prometheus/targets/node_exporter.json'
        refresh_interval: 30s
```

Create the `/etc/prometheus/targets/node_exporter.json` file with your tailnet IPs:

```json
[
  {
    "targets": ["worker1:9100"],
    "labels": {
      "instance": "worker1"
    }
  },
  {
    "targets": ["worker2:9100"],
    "labels": {
      "instance": "worker2"
    }
  },
  {
    "targets": ["worker3:9100"],
    "labels": {
      "instance": "worker3"
    }
  }
]
```

## Troubleshooting

### Can't Access Metrics

1. Verify Tailscale is running on both machines
2. Check firewall rules with `ufw status`
3. Confirm Node Exporter is listening: `ss -tlnp | grep 9100`

### Firewall Issues

If you need to reset UFW rules:

```bash
ufw --force reset
```

Then re-run the configuration portion of the script.

## Conclusion

This setup provides a secure, maintainable way to monitor your infrastructure with Prometheus while keeping sensitive metrics away from the public internet. The combination of Tailscale's zero-trust networking and properly configured firewall rules ensures your monitoring data remains private and secure.

---

*This post was enhanced with assistance from Claude.*
