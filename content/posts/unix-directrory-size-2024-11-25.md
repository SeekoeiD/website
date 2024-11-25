+++
title = 'Unix: Directrory Sizes'
date = 2024-11-25T16:03:37+02:00
draft = false
tags = ['unix', 'linux', 'directory', 'size']
+++

The `df` command is used to display the amount of disk space available on the file system. The `du` command is used to estimate file space usage.

To get the size of a directory, use the `du` command with the `-sh` options:

```bash
du -sh /path/to/directory
```

`-s` option will display only the total size of the directory and not the size of the subdirectories. `-h` option will display the size in human-readable format.

Example:

```bash
du -sh /var/lib/docker/containers/
437G    /var/lib/docker/containers/
```

To get the size of sub-directories, use the `du` command with the `-d` option:

```bash
du -hd1 /path/to/directory
```

`-d1` option will display the size of the subdirectories up to one level deep.

Example:

```bash
du -hd1 /var/lib/docker/containers/
436G    /var/lib/docker/containers/035574feec643521a5728fe4f1424ab878e2bffd3d78675c82b897d49b0fa92c
152K    /var/lib/docker/containers/dda4fcc8995e354c07bbd564969763786cc3ab183900e6f71216c979407073f5
40K     /var/lib/docker/containers/a91ff8df3197a01ebe5aba215407c8109ee45c5b1cba01c5cf42ac2db6c282ce
88K     /var/lib/docker/containers/cc03423a57c7b93b077c188af602e9dd6e4e691291aea06d49d64225d41c41ac
1.4G    /var/lib/docker/containers/1496d3ea902f8fdf453b94c1ee37383ffbaa0da85ebb55eaa3b31cc5f5095d32
437G    /var/lib/docker/containers/
```
