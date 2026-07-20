// swift-tools-version:5.3
import PackageDescription

let package = Package(
  name: "tauri-plugin-warp-achievements",
  platforms: [
    .iOS(.v13),
  ],
  products: [
    .library(
      name: "tauri-plugin-warp-achievements",
      type: .static,
      targets: ["tauri-plugin-warp-achievements"])
  ],
  dependencies: [
    .package(name: "Tauri", path: "../.tauri/tauri-api")
  ],
  targets: [
    .target(
      name: "tauri-plugin-warp-achievements",
      dependencies: [
        .byName(name: "Tauri")
      ],
      path: "Sources")
  ]
)
