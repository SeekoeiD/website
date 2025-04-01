+++
title = 'Docker Desktop on Windows: Install to Alternative Location'
date = 2024-11-07T00:00:00+02:00
draft = false
tags = ['docker']
+++

I want to use an alternative location for the Docker Desktop installation on Windows. The default location is `C:\Program Files\Docker\Docker`. I want to install Docker Desktop to `D:\Docker\Docker`.

Open a Command Prompt or PowerShell window in the location where you have downloaded the Docker Desktop installer. Run the following command to install Docker Desktop to the alternative location. You can open a Command Prompt or PowerShell window in the location where you have downloaded the Docker Desktop installer by holding down the `Shift` key and right-clicking in the folder. Select `Open command window here` or `Open PowerShell window here`.

Command Promt:

```bash
start /w "" "Docker Desktop Installer.exe" install -accept-license --installation-dir=D:\\Docker --wsl-default-data-root=D:\\Docker\\images
```

Terminal or PowerShell:

```bash
start-Process -Wait -FilePath "Docker Desktop Installer.exe" -ArgumentList "install", "-accept-license", "--installation-dir=D:\Docker\Docker", "--wsl-default-data-root=D:\Docker\wsl", "--windows-containers-default-data-root=D:\\Docker"
```
