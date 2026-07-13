#!/usr/bin/env pwsh
# Quick Windows build - assumes libs are already built on macOS
# Usage: .\scripts\build-windows-quick.ps1

$ErrorActionPreference = "Stop"

Write-Host "Quick Windows build for Warp 12..." -ForegroundColor Cyan
Write-Host "(Assuming libraries are already built on macOS)" -ForegroundColor Yellow

Push-Location $PSScriptRoot\..

try {
    # Just build the Tauri app (skip beforeBuildCommand)
    Write-Host "`nBuilding Tauri app..." -ForegroundColor Yellow
    Set-Location apps\Warp12
    
    # Build without running beforeBuildCommand
    $env:TAURI_SKIP_DEVSERVER_CHECK = "true"
    npx tauri build --no-bundle  # Build binary only first to test
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✓ Build successful!" -ForegroundColor Green
        Write-Host "`nNow creating installers..." -ForegroundColor Yellow
        npx tauri build  # Full build with installers
    }
    
    Write-Host "`n✓ Build complete!" -ForegroundColor Green
    Write-Host "`nInstallers created at:" -ForegroundColor Cyan
    Write-Host "  • src-tauri\target\release\bundle\msi\" -ForegroundColor White
    Write-Host "  • src-tauri\target\release\bundle\nsis\" -ForegroundColor White
}
catch {
    Write-Host "`n✗ Build failed: $_" -ForegroundColor Red
    Write-Host "`nMake sure to run 'yarn build:all' on macOS first!" -ForegroundColor Yellow
    exit 1
}
finally {
    Pop-Location
}
