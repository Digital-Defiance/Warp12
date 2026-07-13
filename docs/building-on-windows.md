# Building Warp 12 on Windows (Parallels)

## Initial Setup (One-time)

### 1. Install Prerequisites

Open PowerShell as Administrator and run:

```powershell
# Install Chocolatey
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install required tools
choco install nodejs-lts -y
choco install rustup.install -y
choco install visualstudio2022buildtools --package-parameters "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive" -y

# Restart your terminal after this
```

### 2. Setup Workspace

```powershell
# Navigate to shared Mac folder (adjust drive letter if needed)
cd Y:\Volumes\Code\Warp12

# Enable Yarn 4
corepack enable

# Install dependencies
yarn install
```

## Building

### Standard Windows Build (MSI + NSIS)

```powershell
# From repo root
yarn tauri:build

# Or use the helper script
.\scripts\build-windows.ps1
```

**Output:**
- `apps/Warp12/src-tauri/target/release/bundle/msi/*.msi` - Windows Installer
- `apps/Warp12/src-tauri/target/release/bundle/nsis/*.exe` - Self-extracting installer

### Microsoft Store Build (MSIX)

```powershell
# Build MSIX for Store submission
yarn build:windows:store

# Or use the helper script
.\scripts\build-windows-store.ps1
```

**Output:**
- `apps/Warp12/src-tauri/target/release/bundle/msix/*.msix` - Store package

### Test MSIX Locally

```powershell
# Enable Developer Mode in Windows Settings first
# Then install the MSIX:
Add-AppxPackage "apps\Warp12\src-tauri\target\release\bundle\msix\Warp 12_0.5.40_x64_en-US.msix"

# To uninstall:
Get-AppxPackage *Warp* | Remove-AppxPackage
```

## Common Issues

### "tauri not recognized"

**Problem:** Tauri CLI not found

**Solution:**
```powershell
# Ensure dependencies are installed
yarn install

# Use npx to run tauri
npx tauri --version

# Or run via yarn scripts
yarn tauri:build
```

### Build fails with "linker not found"

**Problem:** Visual Studio Build Tools not installed

**Solution:**
```powershell
choco install visualstudio2022buildtools --package-parameters "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive" -y
```

### Slow builds

**Problem:** Shared folder I/O overhead

**Solution:** Adjust Parallels settings:
- Allocate 6+ CPU cores
- Allocate 8+ GB RAM
- Use "Plain" disk type (not "Expanding")

### Permission errors

**Problem:** Running from shared Mac folder

**Solution:**
```powershell
# Run PowerShell as Administrator
# Or copy project to Windows drive (not recommended)
```

## Quick Commands Reference

```powershell
# Development server
yarn serve:bridge

# Build all libraries
yarn build:all

# Build Windows installers
yarn tauri:build

# Build Windows Store package
yarn build:windows:store

# Test locally
yarn tauri:dev
```

## File Paths

When working in Windows with Parallels shared folders:

| Location | Path |
|----------|------|
| Workspace | `Y:\Volumes\Code\Warp12` |
| Build output | `apps\Warp12\src-tauri\target\release\bundle\` |
| MSI | `bundle\msi\` |
| NSIS | `bundle\nsis\` |
| MSIX | `bundle\msix\` |

## Performance Tips

```powershell
# Use parallel Rust compilation
$env:CARGO_BUILD_JOBS = "6"

# Clear Rust build cache if needed
cd apps\Warp12\src-tauri
cargo clean
```

## Signing MSIX (for Store submission)

```powershell
# You need a code signing certificate
# Purchase from DigiCert, Sectigo, etc. or get from Microsoft Partner Center

# Sign the MSIX
signtool sign /fd SHA256 /a /f YourCert.pfx /p YourPassword `
  "apps\Warp12\src-tauri\target\release\bundle\msix\Warp 12_0.5.40_x64_en-US.msix"
```

## Next Steps

After building:
1. Test the installer on a clean Windows machine
2. Submit MSIX to Microsoft Partner Center
3. Wait for certification (1-3 days)
4. Celebrate! 🎉
