+++
title = 'Ubuntu 24.04: Expand LVM Root'
date = 2025-03-27T00:00:00+02:00
draft = false
tags = ['unix', 'ubuntu', 'directory', 'size']
+++

When you install Ubuntu 24.04 and tell is to use the full disk it only creates a 100 GB root volume. We can expand it to use the full available disk space.

When you run `vgdisplay` it will list the available disk space you can use. The `Free  PE / Size   95715 / <373.89 GiB` line shows that we have 373.89 GiB of the 500 GB SSD available to use.

```bash
  --- Volume group ---
  VG Name     ubuntu-vg
  System ID
  Format      lvm2
  Metadata Areas    1
  Metadata Sequence No  2
  VG Access     read/write
  VG Status     resizable
  MAX LV      0
  Cur LV      1
  Open LV     1
  Max PV      0
  Cur PV      1
  Act PV      1
  VG Size     <473.89 GiB
  PE Size     4.00 MiB
  Total PE      121315
  Alloc PE / Size   25600 / 100.00 GiB
  Free  PE / Size   95715 / <373.89 GiB
```

Extend the root logical volume to use all free space:

```bash
lvextend -l +100%FREE /dev/mapper/ubuntu--vg-ubuntu--lv
```

Check the type of your root file system:

```bash
df -T /
```

If it is `ext4` you can resize it with:

```bash
resize2fs /dev/mapper/ubuntu--vg-ubuntu--lv
```

If it is `xfs` you can resize it with:

```bash
xfs_growfs /
```

You can check the new size with:

```bash
df -h /
```

You should see the root file system size has increased to the full disk size.
