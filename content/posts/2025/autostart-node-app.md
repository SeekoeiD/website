+++
title = 'Autostart Node App'
date = 2025-04-22T00:00:00+02:00
draft = false
tags = ['ubuntu', 'nvm', 'nodejs', 'npm']
+++

The easiest way to manage Nodejs runtimes is to use NVM (Node Version Manager). This allows you to install multiple versions of Nodejs and switch between them easily. You can install NVM by following the instructions on the NVM Github page: <https://github.com/nvm-sh/nvm>.

But, the NVM and Nodejs runtime are not always available when you start a Nodejs app on a server. This is because the environment variables are not set up correctly when the server starts up. To solve this problem, we have to load NVM and Nodejs in the script that starts the app.

My `/home/app.sh` script:

```bash
#!/bin/bash

# Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use Node.js version 20
nvm use 20

cd /home/my-app-directory

while true
do
  git pull
  npm install
  npm run app

  echo "App crashed, restarting in 10 seconds..."
  sleep 10
done
```

I use `crontab -e` to create `@reboot` tasks. This will run the command when the server starts up. For example:

```bash
@reboot screen -dmS app /home/app.sh
```
