param(
    [string]$ProjectName = "my-blog",
    [string]$Branch = "main",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$wrangler = "C:\Users\17978\tools\wrangler\node_modules\.bin\wrangler.cmd"
if (-not (Test-Path -LiteralPath $wrangler)) {
    throw "找不到 wrangler：$wrangler`n请先执行：npm install wrangler --prefix C:\Users\17978\tools\wrangler --registry=https://registry.npmmirror.com"
}

# ---- 1. 认证：优先环境变量，其次本地 token 文件 ----
if (-not $env:CLOUDFLARE_API_TOKEN) {
    $tokenFile = Join-Path $env:USERPROFILE ".cloudflare\pages_token.txt"
    if (Test-Path -LiteralPath $tokenFile) {
        $env:CLOUDFLARE_API_TOKEN = (Get-Content -LiteralPath $tokenFile -Raw).Trim()
        Write-Host "使用 token 文件：$tokenFile" -ForegroundColor DarkGray
    } else {
        throw @"
没有找到 Cloudflare 凭据。二选一：
  1) 创建 API Token（长期有效）：https://dash.cloudflare.com/profile/api-tokens
     模板选 Edit Cloudflare Workers，然后保存到：
     $tokenFile
     内容只放 token 本身，一行。
  2) 本次临时登录：现在执行下面命令，浏览器点 Allow 后重跑本脚本
     & "$wrangler" login
"@
    }
}

# ---- 2. 构建 ----
if (-not $SkipBuild) {
    $hugo = (Get-Command hugo -ErrorAction SilentlyContinue).Source
    if (-not $hugo) { $hugo = "C:\Users\17978\tools\hugo\hugo.exe" }
    if (-not (Test-Path -LiteralPath $hugo)) { throw "找不到 hugo，请先安装或加入 PATH" }

    Write-Host "1/2 构建静态文件..." -ForegroundColor Cyan
    & $hugo --minify
    if ($LASTEXITCODE -ne 0) { throw "Hugo 构建失败" }
}

# ---- 3. 发布 ----
Write-Host "2/2 发布到 Cloudflare Pages（项目：$ProjectName，分支：$Branch）..." -ForegroundColor Cyan
& $wrangler pages deploy "public" --project-name $ProjectName --branch $Branch --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw "上传失败" }

Write-Host "`n完成。站点：https://wjyzyx.cc.cd/（境外）  备用：https://my-blog-3zi.pages.dev/" -ForegroundColor Green
