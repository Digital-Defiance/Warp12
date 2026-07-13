#!/usr/bin/env pwsh
# Build Warp 12 for Windows
# Usage: .\scripts\build-windows.ps1

$ErrorActionPreference = "Stop"

Write-Host "Building Warp 12 for Windows..." -ForegroundColor Cyan

# Ensure we're in the repo root
Push-Location $PSScriptRoot\..

try {
    # Build all dependencies first
    Write-Host "`nBuilding dependencies..." -ForegroundColor Yellow
    yarn build:all
    
    # Build Tauri app
    Write-Host "`nBuilding Tauri app..." -ForegroundColor Yellow
    Set-Location apps\Warp12
    npx tauri build
    
    Write-Host "`n✓ Build complete!" -ForegroundColor Green
    Write-Host "`nInstallers created at:" -ForegroundColor Cyan
    Write-Host "  • src-tauri\target\release\bundle\msi\" -ForegroundColor White
    Write-Host "  • src-tauri\target\release\bundle\nsis\" -ForegroundColor White
}
catch {
    Write-Host "`n✗ Build failed: $_" -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}
