/// <reference types="vite/client" />
/// <reference types="@tauri-apps/cli/vite" />

declare module '*.md?raw' {
  const content: string;
  export default content;
}
