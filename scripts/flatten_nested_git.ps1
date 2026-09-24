<#
.SYNOPSIS
  Flatten nested git repos in the Atomic Fizz vault checkout.

.DESCRIPTION
  Same hygiene used on RealAI. Nested `.git` folders turn directories into
  gitlinks (mode 160000). GitHub then stores a SHA pointer instead of files,
  so unique code never leaves HOMEPC.

  Default root: C:\Users\tsmit\ATOMIC-FIZZ-CAPS-VAULT-77-WASTELAND-GPS

  Dry-run unless -Apply is passed. Never force-pushes. Never deletes the
  top-level .git.
#>
param(
    [string]$Root = "C:\Users\tsmit\ATOMIC-FIZZ-CAPS-VAULT-77-WASTELAND-GPS",
    [switch]$Apply,
    [switch]$Readd
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $Root)) {
    Write-Error "Root not found: $Root"
}
$rootFull = (Resolve-Path $Root).Path
$rootGit = Join-Path $rootFull ".git"
if (-not (Test-Path $rootGit)) {
    Write-Error "No top-level .git at $rootFull — aborting so we do not init the wrong folder."
}

Write-Host "Root     : $rootFull"
Write-Host "Mode     : $(if ($Apply) { 'APPLY' } else { 'DRY-RUN' })"

$nested = Get-ChildItem -Path $rootFull -Recurse -Force -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Name -eq ".git" -and
        $_.FullName -ne $rootGit
    }

if (-not $nested) {
    Write-Host "No nested .git directories. Tree is already flat."
    exit 0
}

Write-Host "Found $($nested.Count) nested git dir(s):"
foreach ($g in $nested) {
    $parent = Split-Path $g.FullName -Parent
    $rel = $parent.Substring($rootFull.Length).TrimStart("\", "/")
    $kind = if ($g.PSIsContainer) { "dir" } else { "file-gitlink" }
    Write-Host "  [$kind] $rel"
}

if (-not $Apply) {
    Write-Host ""
    Write-Host "Dry-run only. Re-run with -Apply to rename nested .git → .git.nested-bak"
    Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\flatten_nested_git.ps1 -Apply -Readd"
    exit 0
}

foreach ($g in $nested) {
    $bak = "$($g.FullName).nested-bak"
    if (Test-Path $bak) {
        $bak = "$bak-$(Get-Date -Format yyyyMMddHHmmss)"
    }
    Write-Host "Rename $($g.FullName) -> $bak"
    Rename-Item -LiteralPath $g.FullName -NewName (Split-Path $bak -Leaf)
}

if ($Readd) {
    Push-Location $rootFull
    try {
        git rm -r --cached --ignore-unmatch . | Out-Null
        git add -A
        Write-Host "git add -A complete. Review with: git status --short"
        Write-Host "Commit yourself after checking there are no secrets:"
        Write-Host "  git commit -m `"fix: flatten nested git so unique SHA files are tracked`""
    } finally {
        Pop-Location
    }
}

Write-Host "Done. Nested metadata kept as .git.nested-bak* — delete those after a good commit."
