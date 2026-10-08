// Saving and opening files on the web and in the desktop shell.
//
// In a browser we use downloads and <input type="file">. Inside the Tauri
// desktop app we use native dialogs and two small Rust commands
// (apps/desktop/src-tauri/src/lib.rs). The Tauri packages are imported
// lazily, so the web build never loads them.

import { downloadBlob, pickTextFile } from './files';

export interface FileFilter {
  name: string;
  extensions: string[];
}

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Save `data` under a user-chosen name. Returns false if the user cancelled. */
export async function saveFile(name: string, data: Blob | string, filter: FileFilter): Promise<boolean> {
  const blob = typeof data === 'string' ? new Blob([data], { type: 'text/plain;charset=utf-8' }) : data;
  if (!isDesktop()) {
    downloadBlob(blob, name);
    return true;
  }
  const [{ save }, { invoke }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/api/core'),
  ]);
  const path = await save({ defaultPath: name, filters: [filter] });
  if (!path) return false;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await invoke('write_file', { path, contents: Array.from(bytes) });
  return true;
}

/** Ask the user for a text file. Returns null if cancelled. */
export async function openTextFile(filter: FileFilter): Promise<string | null> {
  if (!isDesktop()) {
    return pickTextFile(filter.extensions.map((e) => `.${e}`).join(','));
  }
  const [{ open }, { invoke }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/api/core'),
  ]);
  const path = await open({ multiple: false, directory: false, filters: [filter] });
  if (typeof path !== 'string') return null;
  return invoke<string>('read_text_file', { path });
}
