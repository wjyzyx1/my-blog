param(
    [string]$ProjectName = "my-hugo-blog"
)

$ErrorActionPreference = "Stop"
$hugo = "C:\Users\17978\tools\hugo\hugo.exe"

if (-not (Test-Path -LiteralPath $hugo)) {
    throw "找不到 Hugo：$hugo"
}

Write-Host "1/2 构建静态文件..." -ForegroundColor Cyan
& $hugo --minify
if ($LASTEXITCODE -ne 0) {
    throw "Hugo 构建失败"
}

Write-Host "2/2 上传到 Cloudflare Pages（项目：$ProjectName）..." -ForegroundColor Cyan
npx wrangler pages deploy public --project-name $ProjectName
if ($LASTEXITCODE -ne 0) {
    throw "Wrangler 上传失败，请先执行 npx wrangler login"
}
