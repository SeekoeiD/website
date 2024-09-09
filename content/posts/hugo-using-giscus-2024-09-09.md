+++
title = 'Using Giscus with Hugo'
date = 2024-09-09T15:45:52+02:00
draft = false
tags = ['hugo', 'giscus']
+++

[Giscus](https://giscus.app/) is a comments widget powered by GitHub Discussions. It's a great way to add comments to your static site without relying on third-party services like Disqus or Commento.

I host my Hugo-based website on GitHub Pages and wanted to use Giscus on the same repo for comments. I followed the instructions of [Justing Bird](https://www.justinjbird.me/blog/2023/adding-comments-to-a-hugo-site-using-giscus).

Basics first:

-   My website is hosted in a public repo on Github
-   Its is built with Hugo and deployed to GitHub Pages using GitHub Actions
-   Discussions are enabled on the repo (repo settings -> General -> Features -> Discussions)
-   Install Giscus to the repo from <https://github.com/apps/giscus>
