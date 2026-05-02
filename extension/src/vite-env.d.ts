/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 例如 `https://your-host`（无末尾斜杠）；与后端文档「应用根地址」一致 */
  readonly VITE_KHAN_API_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
