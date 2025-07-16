+++
title = 'Ubuntu: Disable Auto Updates'
date = 2025-04-16T00:00:00+02:00
draft = false
tags = ['ubuntu']
+++

Ubuntu 24.04 server comes with automatic updates enabled by default. This is a good thing for most users, but if you are running a server and want to control when updates are installed, you can disable it. It would regulary install updates for my MySQL databases and restart the MySQL service, which is not ideal for a production server.

You can use this script to disable and remove the `unattended-upgrades` package: <https://github.com/SeekoeiD/disable-auto-updates>

```bash
wget -qO- https://raw.githubusercontent.com/SeekoeiD/disable-auto-updates/refs/heads/main/disable-auto-updates.sh | bash
```
