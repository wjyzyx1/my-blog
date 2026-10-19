# 我的博客

基于 **Hugo + PaperMod** 的静态博客，部署目标是 **Cloudflare Pages（免费）**。

## 本地预览

```powershell
cd C:\Users\17978\blog
hugo server -D
```

打开 http://localhost:1313/ 。

## 写一篇新文章

```powershell
hugo new content posts/my-first-post.md
```

然后编辑 `content/posts/my-first-post.md`，把 `draft: true` 改成 `false`。

## 需要改的地方

| 内容 | 文件 |
|---|---|
| 站点标题、作者、简介、社交链接 | `hugo.toml` |
| 首页欢迎语 | `hugo.toml` 里的 `[params.homeInfoParams]` |
| 关于页 | `content/about.md` |
| 示例文章 | `content/posts/hello-world.md` |
| 中文字体/行高 | `assets/css/extended/custom.css` |

部署前务必把 `hugo.toml` 里的：

```toml
baseURL = "https://example.com/"
```

改成你的正式地址，例如：

```toml
baseURL = "https://my-blog.pages.dev/"
```

如果绑定了自定义域名，就写自定义域名。

## 部署到 Cloudflare Pages

### 方式 A：GitHub 自动部署（推荐）

1. 在 GitHub 新建一个空仓库，例如 `my-blog`。
2. 在本目录执行：

```powershell
cd C:\Users\17978\blog
git init
git add .
git commit -m "init hugo blog with PaperMod"
git branch -M main
git remote add origin https://github.com/你的用户名/my-blog.git
git push -u origin main
```

3. 打开 Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
4. 选择刚才的仓库，构建设置填：

| 设置项 | 值 |
|---|---|
| Framework preset | Hugo |
| Build command | `hugo --minify` |
| Build output directory | `public` |
| Environment variable | `HUGO_VERSION = 0.168.0` |

5. 点 **Save and Deploy**。首次构建完成后会得到一个 `https://<项目名>.pages.dev/` 地址。
6. 把这个地址填回 `hugo.toml` 的 `baseURL`，再 `git push` 一次。

> 主题已经放在 `themes/PaperMod` 里，随仓库一起提交，不需要配置 Git submodule，Cloudflare 直接能构建。

### 方式 B：Wrangler 直接上传（不用 GitHub）

首次先登录：

```powershell
npx wrangler login
```

然后执行：

```powershell
cd C:\Users\17978\blog
.\deploy-cloudflare.ps1 -ProjectName my-hugo-blog
```

`ProjectName` 会决定 `https://<ProjectName>.pages.dev/`，创建后不能改名，想好再执行。

### 绑定自己的域名

Cloudflare Pages 项目 → **Custom domains** → 添加域名，按提示把 DNS 指过去即可。免费套餐够用。

## 目录结构

```text
blog/
├─ content/
│  ├─ posts/            # 文章
│  ├─ about.md          # 关于
│  ├─ archives.md       # 归档页
│  └─ search.md         # 搜索页
├─ assets/css/extended/ # 自定义样式
├─ themes/PaperMod/     # 主题（随仓库提交）
├─ hugo.toml            # 站点配置
└─ deploy-cloudflare.ps1
```

## 常用命令

```powershell
hugo server -D          # 本地预览（含草稿）
hugo --minify           # 生成 public/
hugo new content posts/xxx.md
```
