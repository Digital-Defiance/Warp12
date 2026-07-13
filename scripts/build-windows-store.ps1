#!/usr/bin/env pwsh
# Build Warp 12 MSIX for Microsoft Store
# Usage: .\scripts\build-windows-store.ps1

param(
    [string]$CertFile = "",
    [string]$CertPassword = ""
)

$ErrorActionPreference = "Stop"

Write-Host "Building Warp 12 MSIX for Windows Store..." -ForegroundColor Cyan

# Ensure we're in the repo root
Push-Location $PSScriptRoot\..

try {
    # Build all dependencies first
    Write-Host "`nBuilding dependencies..." -ForegroundColor Yellow
    yarn build:all
    
    # Build Tauri MSIX
    Write-Host "`nBuilding Tauri MSIX..." -ForegroundColor Yellow
    Set-Location apps\Warp12
    npx tauri build --bundles msix
    
    $msixPath = "src-tauri\target\release\bundle\msix"
    $msixFile = Get-ChildItem -Path $msixPath -Filter "*.msix" | Select-Object -First 1
    
    if (-not $msixFile) {
        throw "MSIX file not found in $msixPath"
    }
    
    Write-Host "`n✓ MSIX created: $($msixFile.Name)" -ForegroundColor Green
    
    # Sign if certificate provided
    if ($CertFile -and $CertPassword) {
        Write-Host "`nSigning MSIX..." -ForegroundColor Yellow
        signtool sign /fd SHA256 /a /f $CertFile /p $CertPassword $msixFile.FullName
        Write-Host "✓ MSIX signed" -ForegroundColor Green
    }
    else {
        Write-Host "`nℹ️  MSIX not signed (provide -CertFile and -CertPassword to sign)" -ForegroundColor Yellow
    }
    
    Write-Host "`nMSIX location:" -ForegroundColor Cyan
    Write-Host "  $($msixFile.FullName)" -ForegroundColor White
    
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "  1. Test locally: Add-AppxPackage $($msixFile.Name)" -ForegroundColor White
    Write-Host "  2. Upload to Microsoft Partner Center" -ForegroundColor White
    Write-Host "  3. Submit for certification" -ForegroundColor White
}
catch {
    Write-Host "`n✗ Build failed: $_" -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}
