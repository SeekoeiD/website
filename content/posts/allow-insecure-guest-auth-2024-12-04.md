+++
title = 'Windows: AllowInsecureGuestAuth'
date = 2024-12-04T14:52:34+02:00
draft = false
tags = ['windows', 'smb', 'samba', 'insecure', 'guest', 'auth']
+++

On an Ubuntu 22.04 server I have Samba shares for my Windows clients. The clients should be able to use the shares as anonymous users.

My `smb.conf` file:

```bash
[10TB HDD Mirror]
   path = /hdd1/files
   writeable = yes
   browseable = yes
   public = yes
   create mask = 0777
   directory mask = 0777
   force user = root
```

When I try to access the shares from a Windows client, I get the following error:

![AllowInsecureGuestAuth](/images/allowinsecureguestauth.png)

To fix this, I need to allow insecure guest auth on the Windows client. To do this, I need to add/change the `AllowInsecureGuestAuth` registry key.

1. Open the Registry Editor by pressing `Win + R`, typing `regedit`, and pressing `Enter`
2. Navigate to `HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\LanmanWorkstation\Parameters`
3. Right-click on the right pane and select `New` &#8594; `DWORD (32-bit) Value`
4. Name the new value `AllowInsecureGuestAuth` and set its value to `1`
