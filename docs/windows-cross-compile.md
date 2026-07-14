# Windows Cross-Compilation from macOS

## What's Happening

When you run `yarn build:windows:cross`, it:

1. **Builds all JavaScript/TypeScript libraries** (5-10 minutes)
   - double-eighteen (domino rendering)
   - warp12-engine (game logic)
   - warp12-react (UI components)
   - warp12-theme (federation skins)
   - bridge app (main Tauri frontend)
   - Cloud Functions

2. **Cross-compiles the Rust/Tauri binary for Windows** (2-5 minutes)
   - Uses `cargo-xwin` to compile for `x86_64-pc-windows-msvc`
   - Downloads Windows SDK components as needed
   - Produces a Windows `.exe` file

## Output

After completion, you'll have:

```
apps/Warp12/src-tauri/target/x86_64-pc-windows-msvc/release/
  └── Warp 12.exe   (Windows executable)
```

## What This Gets You

✅ **Native Windows executable**
- Runs on Windows 10/11 (64-bit)
- No installer, just the `.exe`
- Can be tested directly on Windows

❌ **What's NOT included:**
- No MSI installer
- No MSIX package (for Microsoft Store)
- No NSIS self-extractor

## Creating Installers

Installers (MSI, NSIS, MSIX) require Windows-only tooling and **cannot** be
produced by the macOS cross-compile. Build them on Windows instead — the
recommended path is CI.

### Recommended: GitHub Actions (`.github/workflows/build-windows.yml`)
Triggered on `v*` tags or via manual dispatch. The `windows-latest` runner
produces:
- **MSI** (WiX) and **NSIS** `-setup.exe` via `yarn tauri:build`
- **MSIX** — a multiarch (`x64` + `arm64`) `Warp 12.msixbundle` via
  `yarn build:windows:store`

Trigger it from macOS without touching Windows:

```bash
git tag v0.6.45 && git push origin v0.6.45   # or: gh workflow run build-windows.yml
```

### MSIX details
MSIX packaging is handled by [`@choochmeque/tauri-windows-bundle`](https://github.com/Choochmeque/tauri-windows-bundle)
(Tauri v2 has no native MSIX bundler). Config lives in
`apps/Warp12/src-tauri/gen/windows/bundle.config.json` and the manifest template
alongside it. `yarn build:windows:store` runs
`tauri-windows-bundle build --arch x64,arm64 --runner yarn`.

Before a **Microsoft Store** submission, set the reserved identity from Partner
Center:
- `Identity Name` ← override `identifier` in `src-tauri/tauri.windows.conf.json`
- `publisher` (`CN=...`) and `publisherDisplayName` ← `bundle.config.json`

The Store re-signs the uploaded bundle, so it can be unsigned. For **sideload
testing**, sign it: set `signing.pfx` in `bundle.config.json` and provide
`MSIX_PFX_PASSWORD`, then install with `Add-AppxPackage Warp12.msixbundle`.
`org.digitaldefiance.app.warp12` / `CN=Digital Defiance` are the defaults for
self-signed testing.

### Manual alternative
Copy the `.exe` to Windows and use Inno Setup, NSIS, or Advanced Installer.

## Testing the .exe

1. **Copy to Windows:**
   ```bash
   # On macOS
   cp apps/Warp12/src-tauri/target/x86_64-pc-windows-msvc/release/Warp\ 12.exe ~/Desktop/
   ```

2. **Transfer to Windows** (via USB, Parallels shared folder, cloud storage, etc.)

3. **Run on Windows:**
   - Double-click `Warp 12.exe`
   - Should launch the app directly

## Troubleshooting

### Build fails with "linker error"
cargo-xwin needs to download Windows SDK components on first run. This is automatic but requires internet.

### .exe won't run on Windows
- Check Windows version (needs Windows 10 1809+ or Windows 11)
- Install Visual C++ Redistributable if needed
- Check Windows Defender didn't block it

### Build takes forever
First build downloads ~2GB of Windows SDK components. Subsequent builds are much faster (5-10 min total).

## Quick Commands

```bash
# Full cross-compile (with dependency building)
yarn build:windows:cross

# Quick recompile (assumes libs already built)
./scripts/crosscompile-windows-quick.sh

# Check if still building
ps aux | grep -E "(vite|cargo)" | grep -v grep
```

## Performance

| Build Stage | Time (first) | Time (subsequent) |
|-------------|--------------|-------------------|
| JS/TS libs | 5-10 min | 2-5 min (if changed) |
| Rust binary | 5-10 min | 2-3 min (if changed) |
| **Total** | **10-20 min** | **2-8 min** |

## Advantages Over Native Windows Build

✅ Stay on macOS (your main dev environment)  
✅ No Parallels/VM needed  
✅ Scriptable/automatable  
✅ Good for CI/CD  

## Limitations

❌ Can't create MSI/MSIX/NSIS installers (Windows-only — use the CI workflow)  
❌ Can't code-sign for Windows  
❌ First build downloads large SDK  

## Recommendation

- **For testing:** Use cross-compile (this approach)
- **For distribution:** Use the `build-windows.yml` GitHub Actions workflow (MSI + NSIS + MSIX)
- **For Microsoft Store:** Upload the `x64 + arm64` `.msixbundle` from CI (`yarn build:windows:store`)
