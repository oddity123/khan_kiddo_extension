/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 例如 `https://your-host`（无末尾斜杠）；与后端文档「应用根地址」一致 */
  readonly VITE_KHAN_API_ORIGIN?: string;
  /** 可选：完整登录页 URL，优先于 VITE_KHAN_LOGIN_PATH */
  readonly VITE_KHAN_LOGIN_URL?: string;
  /** 可选：登录路径，默认 `/login`，拼在应用根地址后 */
  readonly VITE_KHAN_LOGIN_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
