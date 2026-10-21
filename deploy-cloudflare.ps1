param(
    [string]$ProjectName = "my-blog",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

# 优先用 PATH 上的 hugo，退回到 tools 目录
$hugo = (Get-Command hugo -ErrorAction SilentlyContinue).Source
if (-not $hugo) {
    $fallback = "C:\Users\17978\tools\hugo\hugo.exe"
    if (Test-Path -LiteralPath $fallback) { $hugo = $fallback }
}
if (-not $hugo) { throw "找不到 Hugo，请把 hugo.exe 加入 PATH，或修改本脚本里的路径" }

$version = (& $hugo version) -join " "
Write-Host "使用 Hugo: $version" -ForegroundColor DarkGray

if (-not $SkipBuild) {
    Write-Host "1/2 构建静态文件..." -ForegroundColor Cyan
    & $hugo --minify
    if ($LASTEXITCODE -ne 0) { throw "Hugo 构建失败" }
}

Write-Host "2/2 上传到 Cloudflare Pages（项目：$ProjectName）..." -ForegroundColor Cyan
npx --yes wrangler pages deploy public --project-name $ProjectName
if ($LASTEXITCODE -ne 0) {
    throw "Wrangler 上传失败，请先执行：npx wrangler login"
}
