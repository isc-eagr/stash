param(
  [switch]$SkipBuild,
  [switch]$SkipStart
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$sourceExe = Join-Path $repoRoot "stash.exe"
$targets = @(
  @{ Name = "Main"; Directory = "C:\Stash"; Exe = "C:\Stash\stash.exe" },
  @{ Name = "Amateur"; Directory = "C:\Amt\Stash"; Exe = "C:\Amt\Stash\stash.exe" }
)

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-RepoCommand {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )

  Write-Step "$FilePath $($Arguments -join ' ')"
  Push-Location $repoRoot
  try {
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
    }
  } finally {
    Pop-Location
  }
}

function Stop-StashInstance {
  param([hashtable]$Target)

  $targetExe = [System.IO.Path]::GetFullPath($Target.Exe)
  $processes = Get-CimInstance Win32_Process |
    Where-Object {
      $_.Name -ieq "stash.exe" -and
      $_.ExecutablePath -and
      ([System.IO.Path]::GetFullPath($_.ExecutablePath) -ieq $targetExe)
    }

  foreach ($process in $processes) {
    Write-Step "Stopping $($Target.Name) Stash process $($process.ProcessId)"
    Stop-Process -Id $process.ProcessId -Force
    Wait-Process -Id $process.ProcessId -Timeout 30 -ErrorAction SilentlyContinue
  }
}

function Backup-ExistingExe {
  param([hashtable]$Target)

  if (!(Test-Path $Target.Exe)) {
    return
  }

  $backupDir = Join-Path $Target.Directory ".deploy-backups"
  New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $backupPath = Join-Path $backupDir "stash-$timestamp.exe"
  Copy-Item -LiteralPath $Target.Exe -Destination $backupPath -Force
  Write-Host "Backed up $($Target.Name) exe to $backupPath"
  return $backupPath
}

function Deploy-StashInstance {
  param([hashtable]$Target)

  if (!(Test-Path $Target.Directory)) {
    throw "Target directory does not exist: $($Target.Directory)"
  }

  $backupPath = Backup-ExistingExe $Target
  Copy-Item -LiteralPath $sourceExe -Destination $Target.Exe -Force
  Write-Host "Copied new stash.exe to $($Target.Exe)"
  return $backupPath
}

function Remove-DeploySourceExe {
  if (!(Test-Path $sourceExe)) {
    return
  }

  Remove-Item -LiteralPath $sourceExe -Force
  Write-Host "Removed deploy staging exe $sourceExe"
}

function Remove-DeployBackups {
  param([string[]]$BackupPaths)

  foreach ($backupPath in $BackupPaths) {
    if (!(Test-Path $backupPath)) {
      continue
    }

    Remove-Item -LiteralPath $backupPath -Force
    Write-Host "Removed deploy backup exe $backupPath"
  }
}

function Start-StashInstance {
  param([hashtable]$Target)

  Write-Step "Starting $($Target.Name) Stash"
  $logDir = Join-Path $Target.Directory ".deploy-logs"
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null

  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $safeName = $Target.Name.ToLowerInvariant()
  $stdoutPath = Join-Path $logDir "stash-$safeName-$timestamp.out.log"
  $stderrPath = Join-Path $logDir "stash-$safeName-$timestamp.err.log"

  $process = Start-Process `
    -FilePath $Target.Exe `
    -WorkingDirectory $Target.Directory `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru

  Start-Sleep -Seconds 2
  if ($process.HasExited) {
    $stderr = ""
    if (Test-Path $stderrPath) {
      $stderr = Get-Content -LiteralPath $stderrPath -Raw
    }
    throw "$($Target.Name) Stash exited immediately with code $($process.ExitCode). stderr: $stderr"
  }

  Write-Host "Started $($Target.Name) Stash process $($process.Id)"
  Write-Host "Logs: $stdoutPath ; $stderrPath"
}

if (!$SkipBuild) {
  Invoke-RepoCommand "mingw32-make" @("pre-ui")
  Invoke-RepoCommand "mingw32-make" @("generate")
  Invoke-RepoCommand "mingw32-make" @("ui")
  Invoke-RepoCommand "mingw32-make" @("build-release")
}

if (!(Test-Path $sourceExe)) {
  throw "Build artifact not found: $sourceExe"
}

Write-Step "Deploying $sourceExe"
foreach ($target in $targets) {
  Stop-StashInstance $target
}

$backupPaths = @()
foreach ($target in $targets) {
  $backupPath = Deploy-StashInstance $target
  if ($backupPath) {
    $backupPaths += $backupPath
  }
}

if (!$SkipStart) {
  foreach ($target in $targets) {
    Start-StashInstance $target
  }
}

Remove-DeployBackups $backupPaths
Remove-DeploySourceExe

Write-Step "Production deploy complete"
