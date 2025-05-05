+++
title = 'Using Giscus with Hugo'
date = 2024-09-09T00:00:00+02:00
draft = false
tags = ['hugo', 'giscus']
+++

[Giscus](https://giscus.app/) is a comments widget powered by GitHub Discussions. It's a great way to add comments to your static site without relying on third-party services like Disqus or Commento.

I host my Hugo-based website on GitHub Pages and wanted to use Giscus on the same repo for comments. I followed the instructions from [Justing Bird](https://www.justinjbird.me/blog/2023/adding-comments-to-a-hugo-site-using-giscus).

Basics first:

- My website is hosted in a public repo on Github
- Its is built with Hugo and deployed to GitHub Pages using GitHub Actions
- Discussions are enabled on the repo (repo settings -> General -> Features -> Discussions)
- Install Giscus to the repo from <https://github.com/apps/giscus>
- Get your Giscus script by generating it here: <https://giscus.app/>

Integrating Giscus with Hugo:

I use a [Soho](https://themes.gohugo.io/themes/soho/) template that provides functionality for Discus. I've moved all the template files to the `layouts` directory so that my project structure looks like this:

![project layout](/images/project-layout.png)

The Discus code is in `single.html`. I created `giscus.html` in the `partials` directory and editted `single.html` to include `giscus.html` instead of the Discus code. In `config.toml`, I added a parameter `enableGiscusComments` under `[params]` to enable or disable comments.

`giscus.html`:

```html
<script
  src="https://giscus.app/client.js"
  data-repo="SeekoeiD/website"
  data-repo-id="R_kgDOMqEhoQ"
  data-category="General"
  data-category-id="DIC_kwDOMqEhoc4CiUot"
  data-mapping="pathname"
  data-strict="0"
  data-reactions-enabled="1"
  data-emit-metadata="0"
  data-input-position="bottom"
  data-theme="preferred_color_scheme"
  data-lang="en"
  crossorigin="anonymous"
  async
></script>
```

`single.html`:

```html
{{ if (.Site.Params.enableGiscusComments) -}}
<div class="comments">
  <h2>Comments</h2>
  {{ partial "giscus.html" . }}
</div>
{{- end }}
```

You can interact with discussions on the repo on your Github repo's [Discussions](https://github.com/SeekoeiD/website/discussions) tab:

![github-discussions](/images/github-discussions.png)
