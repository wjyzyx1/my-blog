---
title: "第一篇：你好，Hugo"
date: 2026-10-19T10:00:00+08:00
draft: false
tags: ["Hugo", "博客", "PaperMod"]
categories: ["随笔"]
summary: "从零搭好 Hugo + PaperMod，并准备部署到 Cloudflare Pages。"
ShowToc: true
TocOpen: false
---

欢迎来到我的博客。这是第一篇文章，用来确认站点、主题和构建流程都正常。

## 为什么用 Hugo

Hugo 是一个用 Go 写的静态网站生成器，构建速度快，生成的是纯静态文件，托管成本很低。配合 Cloudflare Pages，可以免费部署，并且自带 HTTPS 和全球 CDN。

## 为什么选 PaperMod

PaperMod 轻量、干净，默认支持：

- 深色 / 浅色模式自动切换
- 文章目录、阅读时长、字数统计
- 标签、分类、归档、搜索
- RSS 和代码复制按钮
- 不错的移动端阅读体验

## 接下来做什么

1. 把站点信息改成你自己的名字和简介
2. 写几篇文章，替换掉这篇示例
3. 推送到 GitHub
4. 在 Cloudflare Pages 里连接仓库，自动构建发布

```bash
# 本地预览
hugo server -D

# 生成静态文件
hugo --minify
```

如果这段代码块、目录和页面样式都正常，说明基础配置已经跑通了。
