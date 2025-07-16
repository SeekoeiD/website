+++
title = 'journalctl Logs'
date = 2025-05-05T00:00:00+02:00
draft = false
tags = ['ubuntu']
+++

The `journalctl` command is used to query and display messages from the journal, which is a component of the systemd system and service manager. It provides a way to view logs from various sources, including the kernel, system services, and user applications.

Basic Usage:

To view the logs, you can use the following command:

```bash
journalctl
```

This will display the logs in chronological order, with the most recent entries at the bottom. You can scroll through the logs using the arrow keys or `Page Up` and `Page Down`.
You can also use the `--follow` option to follow the logs in real-time, similar to the `tail -f` command:

```bash
journalctl --follow
```

You can view the logs in reverse order (most recent first) using the `--reverse` option:

```bash
journalctl --reverse
```

Filtering Logs:

You can filter the logs by various criteria, such as time, service, or priority. Here are some common options:

- `--unit=<service>`: Show logs for a specific service. For example, to view logs for the `mysql` service:

```bash
journalctl --unit=mysql
```

- `--since=<time>`: Show logs since a specific time. For example, to view logs since yesterday:

```bash
journalctl --since="yesterday"
```

- `--until=<time>`: Show logs until a specific time. For example, to view logs until 2 hours ago:

```bash
journalctl --until="2 hours ago"
```

- `--dmesg`: Show kernel message log from the current boot. This is useful for debugging hardware issues. `journalctl --dmesg` is better than `dmesg` because it shows the logs in a more readable format with timestamps and allows you to filter them.

```bash
journalctl --dmesg
```

My most-used commands are:

```bash
journalctl --dmesg --output=short-iso
journalctl --dmesg --output=short-iso --since "10 minutes ago"
journalctl --dmesg --output=short-iso --since "1 hour ago"
journalctl --dmesg --output=short-iso --since "1 day ago"
journalctl --dmesg --reverse --output=short-iso
```
