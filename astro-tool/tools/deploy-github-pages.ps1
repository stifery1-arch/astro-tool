<#
    deploy-github-pages.ps1 - 一键把项目和 GitHub Pages 部署流程准备好

    用法：
        # 1) 先只做本地检查 + 提交（不推远程）
        powershell -ExecutionPolicy Bypass -File tools\deploy-github-pages.ps1

        # 2) 已经有远程仓库时，直接提交并推送
        powershell -ExecutionPolicy Bypass -File tools\deploy-github-pages.ps1 -RemoteUrl https://github.com/你的用户名/仓库名.git

    推送成功后：到 GitHub 仓库 Settings -> Pages -> Source 选 "GitHub Actions"，
    之后每次 push 都会自动构建并发布（只发布公开文件，后台与支付服务端不会上线）。
#>
param(
  [string]$RemoteUrl = '',
  [string]$Branch = 'main',
  [string]$CommitMessage = '部署：星盘工具上线',
  [string]$GitUserName = '',
  [string]$GitUserEmail = '',
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot          # astro-tool
$repoRoot = Split-Path -Parent $projectRoot              # 仓库根目录（上一级）

function Info($m) { Write-Host $m -ForegroundColor Cyan }
function Warn($m) { Write-Host $m -ForegroundColor Yellow }
function Ok($m) { Write-Host $m -ForegroundColor Green }

# 1) 先跑一遍站点组装，确认「发布内容」干净
if (-not $SkipBuild) {
  Info "== 步骤 1/5：组装并校验发布内容 =="
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'build-site.ps1')
  if ($LASTEXITCODE -ne 0) { throw '站点组装失败，请先修复上面的报错' }
} else {
  Info "== 步骤 1/5：已跳过站点组装 =="
}

# 2) 检查 git 仓库
Info ""
Info "== 步骤 2/5：检查 Git 仓库 =="
Push-Location $repoRoot
try {
  $insideRepo = $false
  try { git rev-parse --is-inside-work-tree 2>$null | Out-Null; $insideRepo = $LASTEXITCODE -eq 0 } catch {}
  if (-not $insideRepo) {
    git init | Out-Null
    Ok "已初始化 Git 仓库：$repoRoot"
  } else {
    Ok "Git 仓库：$repoRoot"
  }

  # 3) 配置提交身份（仅本仓库）
  Info ""
  Info "== 步骤 3/5：检查提交身份 =="
  $name = git config user.name
  $mail = git config user.email
  if ($GitUserName) { git config user.name $GitUserName; $name = $GitUserName }
  if ($GitUserEmail) { git config user.email $GitUserEmail; $mail = $GitUserEmail }
  if (-not $name) {
    $input = Read-Host "请输入提交用的名字（例如你的 GitHub 用户名）"
    if ($input) { git config user.name $input; $name = $input }
  }
  if (-not $mail) {
    $input = Read-Host "请输入提交用的邮箱（GitHub 账号邮箱即可）"
    if ($input) { git config user.email $input; $mail = $input }
  }
  if (-not $name -or -not $mail) { throw '缺少 git 提交身份，无法提交' }
  Ok "提交身份：$name <$mail>"

  # 4) 提交
  Info ""
  Info "== 步骤 4/5：提交代码 =="
  git add -A
  $staged = git diff --cached --name-only
  if ($staged) {
    git commit -m $CommitMessage | Out-Null
    Ok ("已提交 " + ($staged | Measure-Object).Count + " 个文件")
  } else {
    Warn "没有新的改动需要提交"
  }

  # 分支名规范化（无提交历史时可直接改名为 main）
  $current = git branch --show-current
  if ($current -ne $Branch) {
    $hasCommit = $false
    try { git rev-parse --verify HEAD 2>$null | Out-Null; $hasCommit = $LASTEXITCODE -eq 0 } catch {}
    if (-not $hasCommit -or $current -eq 'master') {
      git branch -M $Branch
      Ok "分支重命名为 $Branch"
    }
  }

  # 5) 远程
  Info ""
  Info "== 步骤 5/5：远程仓库 =="
  $existing = git remote get-url origin 2>$null
  if ($RemoteUrl) {
    if ($existing) { git remote set-url origin $RemoteUrl } else { git remote add origin $RemoteUrl }
    Ok "远程地址：$RemoteUrl"
    Info "开始推送…（首次会要求登录 GitHub）"
    git push -u origin $Branch
    Ok "已推送。接下来到 GitHub 仓库 Settings -> Pages -> Source 选择「GitHub Actions」"
  } else {
    if ($existing) {
      Ok "已有远程：$existing"
      Warn "如需推送，执行：git push -u origin $Branch"
    } else {
      Warn "还没有配置远程仓库。请先完成下面两步："
      Write-Host ""
      Write-Host "  1) 打开 https://github.com/new 新建空仓库（不要勾选 README / .gitignore）" -ForegroundColor White
      Write-Host "     建议仓库名：astro-tool" -ForegroundColor White
      Write-Host "  2) 复制仓库地址后执行（把 <你的用户名> 换成你的）：" -ForegroundColor White
      Write-Host "     git remote add origin https://github.com/<你的用户名>/astro-tool.git" -ForegroundColor Yellow
      Write-Host "     git push -u origin $Branch" -ForegroundColor Yellow
      Write-Host ""
      Write-Host "  或者直接重跑本脚本：" -ForegroundColor White
      Write-Host "     powershell -ExecutionPolicy Bypass -File tools\deploy-github-pages.ps1 -RemoteUrl https://github.com/<你的用户名>/astro-tool.git" -ForegroundColor Yellow
      Write-Host ""
      Write-Host "  3) 推送后在 GitHub 仓库 Settings -> Pages -> Source 选择「GitHub Actions」" -ForegroundColor White
      Write-Host "     约 1 分钟后访问：https://<你的用户名>.github.io/astro-tool/" -ForegroundColor White
    }
  }
}
finally {
  Pop-Location
}