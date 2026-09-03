/**
 * bridge-singleton.ts — Instancia única del DesktopBridge
 *
 * DIP: Se crea una vez y se exporta como módulo.
 * Los componentes importan esta instancia en vez de crear la suya.
 */

import { createDesktopBridge } from './desktop-bridge';

export const bridge = createDesktopBridge();
