+++
title = 'Github Deploy Keys'
date = 2025-04-22T00:00:00+02:00
draft = false
tags = ['unix', 'linux', 'ubuntu','github']
+++

The easiest way to clone, pull and push code to a private repo on Github is to use a deploy key. The deploy key is a public key that you can add to your Github repository. This key will be the public SSH key of your Unix server located at `~/.ssh/id_rsa.pub`. The private key will be located at `~/.ssh/id_rsa` and should never be shared with anyone.

To add the deploy key to your Github repository, follow these steps:

- go to your Github repository (<https://github.com/silversixpence-crypto/dapol>)
- click on `Settings` in the top right corner
- click on `Deploy keys` in the left sidebar
- click on `Add deploy key`
- give the key a title (e.g. `My server`)
- paste the public key from your server into the `Key` field
- check the `Allow write access` box if you want to be able to push to the repo from your server
- click on `Add key`
- you will see a success message and the key will be added to the list of deploy keys

![github-deploy-keys](/images/github-deploy-keys.png)

A problem arises when you want to use this method for multiple repositories on the same server. Github only allows an SSH key to be used once, so we need to use an unique SSH key per repo. We can solve this with some SSH config:

Create a directory to keep all the keys that will be used for repos:

```bash
mkdir /home/github-deploy-keys
```

Create a new SSH key for each repo:

```bash
ssh-keygen -t ed25519 -C "github-deploy-key" -f /home/github-deploy-keys/dapol
```

This will create two files: `/home/github-deploy-keys/dapol` and `/home/github-deploy-keys/dapol.pub`. The first file is the private key and the second file is the public key. The public key should be added to the Github repo as described above.

Now we need to tell SSH to use this key when connecting to Github. To do this, we need to create a new SSH config file:

```bash
nano ~/.ssh/config
```

Add the following lines to the file:

```bash
Host some-name-for-dapol-repo
  HostName github.com
  IdentityFile /home/github-deploy-keys/dapol
```

This tells SSH to use the private key located at `/home/github-deploy-keys/dapol` when connecting to Github. You can add as many keys as you want by creating a new `Host` section for each repo.

Now you can clone the repo using the following command:

```bash
git clone git@some-name-for-dapol-repo:silversixpence-crypto/dapol.git
```
