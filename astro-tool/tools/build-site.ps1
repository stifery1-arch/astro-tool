<#
    build-site.ps1 - 组装「可发布的静态站点」到 _site 目录
    只复制公开文件：index.html / styles.css / js / images
    不包含 tools（订单后台、解锁码生成器）、server（支付后端）、tests、预览图

    用法：
        powershell -ExecutionPolicy Bypass -File tools\build-site.ps1
        powershell -ExecutionPolicy Bypass -File tools\build-site.ps1 -Out D:\www\astro
#>
param(
  [string]$Out = (Join-Path (Split-Path -Parent $PSScriptRoot) '_site')
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$outFull = [System.IO.Path]::GetFullPath($Out)

# 安全校验：只允许在项目目录内清空并写入
if (-not $outFull.StartsWith($projectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "输出目录必须在项目目录内：$projectRoot （当前：$outFull）"
}

Write-Host "项目目录: $projectRoot"
Write-Host "输出目录: $outFull"

if (Test-Path $outFull) {
  Write-Host "清理旧产物..."
  Remove-Item -LiteralPath $outFull -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $outFull | Out-Null

foreach ($f in @('index.html', 'styles.css')) {
  $src = Join-Path $projectRoot $f
  if (-not (Test-Path $src)) { throw "缺少文件：$f" }
  Copy-Item -LiteralPath $src -Destination $outFull -Force
}
foreach ($d in @('js', 'images')) {
  $src = Join-Path $projectRoot $d
  if (Test-Path $src) {
    Copy-Item -LiteralPath $src -Destination (Join-Path $outFull $d) -Recurse -Force
    Write-Host "已复制目录: $d"
  }
}
# 关闭 Jekyll 处理
[System.IO.File]::WriteAllText((Join-Path $outFull '.nojekyll'), '', (New-Object System.Text.UTF8Encoding($false)))

# 校验必需文件
$required = @(
  'index.html', 'styles.css',
  'js\app.js', 'js\orders.js', 'js\pay.js', 'js\ephemeris.js', 'js\astro.js',
  'js\chart.js', 'js\pdf.js', 'js\place.js', 'js\report.js', 'js\report-canvas.js',
  'js\data-cn.js', 'js\data.js', 'js\interpretations.js'
)
$missing = $required | Where-Object { -not (Test-Path (Join-Path $outFull $_)) }
if ($missing) { throw ("产物缺少文件：" + ($missing -join '、')) }

$bad = @('tools', 'server', 'tests') | Where-Object { Test-Path (Join-Path $outFull $_) }
if ($bad) { throw ("产物中不应出现：" + ($bad -join '、')) }

# 上线提醒
$appJs = [System.IO.File]::ReadAllText((Join-Path $outFull 'js\app.js'))
$warn = @()
if ($appJs.Contains("demoCode: 'DEMO-8888'")) { $warn += "CONFIG.pay.demoCode 仍是演示码 DEMO-8888，请改成空字符串" }
if ($appJs.Contains("unlockHashes: []") -and -not $appJs.Contains("apiEnabled: true")) { $warn += "还没有配置任何解锁码哈希：上线后客户即使付款也无法解锁。请用 tools/unlock-codegen.html 或订单管理台生成解锁码，把哈希数组粘贴到 CONFIG.pay.unlockHashes" }
if ($appJs.Contains("xingyu-astro-2026-change-me")) { $warn += "CONFIG.pay.hashSalt 仍是默认值，请改成自己的盐（并同步解锁码生成器 / 订单后台）" }
if ($appJs.Contains("astro-demo-001")) { $warn += "CONFIG.pay.contact 与 contactValue 仍是示例微信号，请改成你自己的" }
if (-not (Test-Path (Join-Path $outFull 'images'))) { $warn += "还没有 images 目录：把收款码图片放进去后会被一起发布" }

$all = Get-ChildItem -LiteralPath $outFull -Recurse -File
$size = ($all | Measure-Object -Property Length -Sum).Sum
Write-Host ""
Write-Host ("产物文件数: " + $all.Count + "    总大小: " + [math]::Round($size / 1024, 1) + " KB")
Write-Host "产物内容:"
$all | ForEach-Object { Write-Host ("  " + $_.FullName.Replace($outFull, '').TrimStart('\')) }

if ($warn.Count) {
  Write-Host ""
  Write-Host "上线前请处理:" -ForegroundColor Yellow
  $warn | ForEach-Object { Write-Host ("  - " + $_) -ForegroundColor Yellow }
}
Write-Host ""
Write-Host "完成。本地预览：双击 $outFull\index.html" -ForegroundColor Green