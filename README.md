# 今天吃啥

基于 **Hugo + PaperMod** 的个人博客，通过 **Cloudflare Pages 的 Git 集成**自动构建发布。

- 仓库：<https://github.com/wjyzyx1/my-blog>
- 线上地址：`https://my-blog.pages.dev/`（以 Cloudflare 首次构建后实际给出的地址为准）
- 本地 Hugo：`0.168.0`（extended，Windows amd64）

## 本地预览

```powershell
cd C:\Users\17978\blog
hugo server -D
```

打开 <http://localhost:1313/>。

## 写一篇新文章

```powershell
hugo new content posts/my-first-post.md
```

编辑 `content/posts/my-first-post.md`，把 `draft: true` 改成 `false`，再提交推送。

## 需要改的地方

| 内容 | 文件 |
|---|---|
| 站点标题、作者、简介、社交链接 | `hugo.toml` |
| 首页欢迎语 | `hugo.toml` 里的 `[params.homeInfoParams]` |
| 关于页 | `content/about.md` |
| 示例文章 | `content/posts/hello-world.md` |
| 自定义样式 | `assets/css/extended/custom.css` |

## Cloudflare Pages 部署（Git 集成，免费）

仓库已经推好，下面是在 Cloudflare 后台一次性操作的步骤。

### 1. 创建 Pages 项目

1. 打开 <https://dash.cloudflare.com/> 登录。
2. 左侧 **Workers & Pages** → **Create application**（或 **Create**）→ 切到 **Pages** 选项卡 → **Import an existing Git repository** / **Connect to Git**。

> Cloudflare 现在默认推荐新建项目用 Workers，但 Pages 的 Git 集成仍然可用，Hugo 博客用 Pages 更省事。

### 2. 授权并选择仓库

1. 选择 **GitHub**，点 **Authorize Cloudflare Pages**（应用名：Cloudflare Workers & Pages）。
2. 授权时可以只勾选 `my-blog` 这一个仓库。
3. 在列表里选中 `wjyzyx1/my-blog` → **Begin setup**。

### 3. 填写构建设置

| 设置项 | 值 |
|---|---|
| Project name | `my-blog` |
| Production branch | `main` |
| Framework preset | `Hugo` |
| Build command | `hugo --minify` |
| Build output directory | `public` |
| Root directory | 留空（仓库根目录就是站点根目录） |

### 4. 设置 Hugo 版本（必须，否则构建必失败）

在 **Environment variables (advanced)** 里加：

```text
HUGO_VERSION = 0.168.0
```

**Production 和 Preview 两个环境都要加**（Cloudflare 把它们分开管理）。

原因：Cloudflare Pages v3 构建镜像的默认 Hugo 是 `0.147.7`，而 PaperMod 要求 `>= 0.158.0`。不设置这个变量，构建会直接失败。

### 5. 部署

点 **Save and Deploy**。首次构建 1~3 分钟，完成后会得到形如 `https://my-blog.pages.dev/` 的地址。

### 6. 回填 baseURL

如果实际域名和 `my-blog.pages.dev` 不一致（重名时 Cloudflare 会自动加后缀），把 `hugo.toml` 里的：

```toml
baseURL = "https://my-blog.pages.dev/"
```

改成实际地址，然后：

```powershell
git add hugo.toml
git commit -m "修正 baseURL"
git push
```

push 之后 Cloudflare 会自动重新构建，不需要再点任何按钮。

### 绑定自定义域名（可选）

Pages 项目 → **Custom domains** → **Set up a domain**，按提示把 DNS 指过去。免费套餐够用，证书自动签发。

## 关于 GitHub 访问与镜像源

- **写操作（push、建仓库、API）必须直连 `github.com` / `api.github.com`**。ghfast、ghproxy 这类国内镜像只做只读加速，不支持带鉴权的推送。
- **只读操作可以用镜像**，例如临时查看主题最新代码：

  ```powershell
  git clone https://ghfast.top/https://github.com/adityatelange/hugo-PaperMod.git PaperMod-latest
  ```

- 本仓库的主题已经放在 `themes/PaperMod/` 并随仓库提交，Cloudflare 构建时不需要联网拉主题，也不需要配置 submodule。

## 备用部署方式（Direct Upload，不走 Git）

如果哪天 GitHub 完全连不上、只想先把内容发出去：

```powershell
npx wrangler login
.\deploy-cloudflare.ps1 -ProjectName my-hugo-blog
```

注意：Cloudflare 的 Git 集成项目**不能**再切换成 Direct Upload，反之亦然，两条路要分开建项目。

## 目录结构

```text
blog/
├─ content/
│  ├─ posts/              # 文章
│  ├─ about.md            # 关于
│  ├─ archives.md         # 归档页
│  └─ search.md           # 搜索页
├─ assets/css/extended/   # 自定义样式
├─ themes/PaperMod/       # 主题（随仓库提交）
├─ hugo.toml              # 站点配置
├─ .gitignore
└─ deploy-cloudflare.ps1  # 备用：wrangler 直传
```

## 常用命令

```powershell
hugo server -D                  # 本地预览（含草稿）
hugo --minify                   # 生成 public/
hugo new content posts/xxx.md   # 新建文章
```

## 排错

| 现象 | 原因 / 处理 |
|---|---|
| 构建日志报 `module "PaperMod" not found` 或主题相关错误 | `HUGO_VERSION` 没设或低于 0.158.0 |
| 页面样式正常但链接指向 `example.com` | `hugo.toml` 的 `baseURL` 没改 |
| 文章列表为空 | 文章 `draft: true`，或 `date` 在未来 |
| 搜索没结果 | 确认 `[outputs] home` 里有 `JSON`，且 `content/search.md` 存在 |
