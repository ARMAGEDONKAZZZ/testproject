// Copyright (c) 2026 Neuratop. All rights reserved.

export type Square = string; // 'a1'..'h8'

export type PieceColor = "w" | "b";

export type PieceKind = "p" | "n" | "b" | "r" | "q" | "k";

export type Piece = { color: PieceColor; kind: PieceKind };

export type Side = "white" | "black";

export type Highlight = { square: Square; tag: string }; // tag -> CSS-класс

export type Overlay =
  | { type: "arrow"; from: Square; to: Square; tag?: string }
  | { type: "circle"; square: Square; tag?: string };

export interface InteractionConfig {
  mode: "none" | "select" | "drag" | "both";
  movableFor: PieceColor[] | "all";
  /** если задано — фигуру можно отпустить только на перечисленные клетки */
  allowedTargets?: Map<Square, Square[]>;
  allowOverlayDrawing: boolean;
}

export interface BoardOptions {
  orientation: Side; // по умолчанию 'white'
  position: string; // FEN; допускается только первое поле
  showCoordinates: boolean; // по умолчанию true
  animationMs: number; // по умолчанию 180; 0 = без анимации
  dragThresholdPx: number; // по умолчанию 3
  interaction: InteractionConfig;
  onMoveAttempt?(from: Square, to: Square): void;
  onSquareActivate?(square: Square): void;
  onOverlaysChange?(overlays: Overlay[]): void;
}
