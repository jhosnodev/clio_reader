/**
 * bridge-singleton.ts — Instancia única del DesktopBridge
 *
 * DIP: Se crea una vez y se exporta como módulo.
 * Los componentes importan esta instancia en vez de crear la suya.
 */

import { createDesktopBridge } from './desktop-bridge';

export const bridge = createDesktopBridge();

export const bridgeExtras = {
  saveFile: (data: { defaultPath: string; content: string }) => window.electronAPI.saveFile(data),
  openFile: (data?: { filters?: Array<{ name: string; extensions: string[] }> }) => window.electronAPI.openFile(data),
};
