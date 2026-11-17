import type { Pos } from '../types'

export const NOTE_W = 96
export const NOTE_H = 88
export const CANVAS_W = 2700
export const CANVAS_H = 1900
export const TRAY_W = 264

/** Mantém o post-it inteiro dentro da área do quadro. */
export function clampToCanvas(p: Pos): Pos {
  return {
    x: Math.round(Math.min(Math.max(p.x, 0), CANVAS_W - NOTE_W)),
    y: Math.round(Math.min(Math.max(p.y, 0), CANVAS_H - NOTE_H)),
  }
}
