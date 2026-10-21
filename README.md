# 今天吃啥

**Hugo + PaperMod** 静态博客，托管在 **Cloudflare Pages**（免费）。

- 仓库：<https://github.com/wjyzyx1/my-blog>
- 正式域名：<https://wjyzyx.cc.cd/>
- 备用域名：<https://my-blog-3zi.pages.dev/>（国内可访问）
- 本地 Hugo：`0.168.0`（extended，Windows amd64）

> ⚠️ **国内访问限制**：`cc.cd` 整个后缀在国内被 SNI 阻断（TLS 握手被重置），
> 与 Cloudflare 配置无关。国内访问请用 `my-blog-3zi.pages.dev`。
> 因为 `baseURL` 是 `wjyzyx.cc.cd`，国内打开 pages.dev 后点站内链接会跳到打不开的域名。

## 本地预览

```powershell
cd D:\个人博客
hugo server -D
```

打开 <http://localhost:1313/>。

## 写一篇新文章

```powershell
hugo new content posts/my-first-post.md
```

编辑 `content/posts/my-first-post.md`，把 `draft: true` 改成 `false`。

## 日常发布（当前方式：wrangler 直传）

> 现在 **`git push` 不会自动发布**，发布靠下面的脚本。

### 一次性准备：保存 Cloudflare Token

1. 打开 <https://dash.cloudflare.com/profile/api-tokens>
2. **Create Token** → 模板 **Edit Cloudflare Workers** → **Create Token**
3. 把 token 存到（只放 token 本身，一行）：

```text
C:\Users\17978\.cloudflare\pages_token.txt
```

### 每次发布

```powershell
cd D:\个人博客
.\deploy.ps1
```

脚本会：构建 → 上传 `public/` → 输出部署结果。可选参数：

```powershell
.\deploy.ps1 -ProjectName my-blog -Branch main
.\deploy.ps1 -SkipBuild          # 已经构建过，直接上传
```

如果不想保存 token，也可以先 `wrangler login`（浏览器点 Allow），再跑脚本。

### 发布 + 同步到 GitHub

```powershell
git add -A
git commit -m "新文章：xxx"
git push
.\deploy.ps1
```

GitHub 直连不稳，push 失败就多试几次；只读场景可用镜像 `https://ghfast.top/https://github.com/...`。

## 站点配置位置

| 内容 | 文件 |
|---|---|
| 站点标题、作者、简介、`baseURL`、社交链接 | `hugo.toml` |
| 首页欢迎语 | `hugo.toml` → `[params.homeInfoParams]` |
| 关于页 | `content/about.md` |
| 示例文章 | `content/posts/hello-world.md` |
| 自定义样式 | `assets/css/extended/custom.css` |

## Cloudflare 侧现状（已完成，备查）

| 项 | 值 |
|---|---|
| Pages 项目名 | `my-blog` |
| 类型 | Direct Upload（wrangler 上传） |
| pages.dev 地址 | `my-blog-3zi.pages.dev`（`my-blog` 已被占用） |
| 自定义域名 | `wjyzyx.cc.cd`（状态 active，证书已签发） |
| DNS | `CNAME @ → my-blog-3zi.pages.dev`，Proxied（橙色云） |
| 账户 | `3022446103@qq.com`（邮箱已验证） |

## 切换到 Git 自动部署（可选，当前未启用）

现在这个项目是 **Direct Upload，不能直接转换成 Git 集成**。要切需要：

1. 安装 GitHub App：<https://github.com/apps/cloudflare-workers-and-pages/installations/new>，授权 `wjyzyx1/my-blog`
2. Cloudflare 后台新建 Pages 项目（或删除现有项目后重建），连接该仓库
3. 构建配置：

   | 设置 | 值 |
   |---|---|
   | Framework preset | `Hugo` |
   | Build command | `hugo --minify` |
   | Build output directory | `public` |
   | 环境变量（生产+预览） | `HUGO_VERSION=0.168.0` |

4. 重新绑定 `wjyzyx.cc.cd`，并确认新的 pages.dev 子域名
5. 若 pages.dev 子域名变了，同步改 `hugo.toml` 的 `baseURL`

> 必须设 `HUGO_VERSION`：Cloudflare Pages v3 构建镜像默认 Hugo 是 `0.147.7`，而 PaperMod 要求 `>= 0.158.0`，不设会构建失败。

## 目录结构

```text
blog/
├─ content/
│  ├─ posts/              # 文章
│  ├─ about.md            # 关于
│  ├─ archives.md         # 归档页
│  └─ search.md           # 搜索页
├─ assets/css/extended/   # 自定义样式
├─ themes/PaperMod/       # 主题（随仓库提交，无需 submodule）
├─ hugo.toml              # 站点配置
├─ deploy.ps1             # 当前发布脚本（wrangler 直传）
├─ deploy-cloudflare.ps1  # 旧版脚本（保留）
└─ .gitignore
```

## 常用命令

```powershell
hugo server -D                  # 本地预览（含草稿）
hugo --minify                   # 生成 public/
hugo new content posts/xxx.md   # 新建文章
.\deploy.ps1                    # 构建 + 发布
```

## 排错

| 现象 | 原因 / 处理 |
|---|---|
| 国内打不开 `wjyzyx.cc.cd`，报连接重置 | `cc.cd` 后缀被 SNI 阻断，换 `my-blog-3zi.pages.dev` 访问 |
| pages.dev 上点链接跳到打不开的域名 | `baseURL` 是自定义域名；要国内可用就把 `baseURL` 改成 pages.dev 再发布 |
| 构建报 `module "PaperMod" not found` | `HUGO_VERSION` 低于 0.158.0（Git 构建时） |
| 本地发布报 `Authentication error` | token 文件缺失或过期，重新生成并存到 `~/.cloudflare/pages_token.txt` |
| 文章列表为空 | 文章 `draft: true`，或 `date` 在未来 |
| 搜索没结果 | 确认 `[outputs] home` 含 `JSON`，且 `content/search.md` 存在 |
