// Copyright (c) 2026 Neuratop. All rights reserved.
//
// Public entry point. Owns state (position, orientation, interaction
// config, highlights, overlays) and orchestrates the pure core modules
// (geometry, position, layers) to render it. The component never moves a
// piece by itself: the host decides whether a move is legal and calls
// setPosition() — see input.ts (phase 5) for onMoveAttempt.
//
// Phase 3 scope: construction, static (non-animated) position/orientation
// rendering, and highlights, since none of those need pointer/keyboard
// input. setInteraction/setOverlays/setPendingMove/clearSelection are
// wired up for real in their designated later phases (5-7) — for now they
// only store state, noted inline on each method.

import {
  createLayers,
  destroyLayers,
  positionSquares,
  renderHighlights,
  renderPiecesStatic,
  type BoardLayers,
} from "./layers";
import { parseFen, serializeFen, type PositionMap } from "./position";
import type { BoardOptions, Highlight, InteractionConfig, Overlay, Side, Square } from "./types";

const DEFAULT_INTERACTION: InteractionConfig = {
  mode: "both",
  movableFor: "all",
  allowOverlayDrawing: false,
};

const DEFAULT_OPTIONS: BoardOptions = {
  orientation: "white",
  position: "8/8/8/8/8/8/8/8",
  showCoordinates: true,
  animationMs: 180,
  dragThresholdPx: 3,
  interaction: DEFAULT_INTERACTION,
};

export class BoardView {
  private readonly root: HTMLElement;
  private readonly layers: BoardLayers;
  private options: BoardOptions;
  private placement: PositionMap = new Map();
  private rest = "";
  private highlights: Highlight[] = [];
  private pendingMove: { from: Square; to: Square } | null = null;

  constructor(root: HTMLElement, options?: Partial<BoardOptions>) {
    this.root = root;
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      interaction: options?.interaction ?? DEFAULT_INTERACTION,
    };
    this.layers = createLayers(root);
    root.classList.toggle("bv-show-coordinates", this.options.showCoordinates);

    this.applyFen(this.options.position, "constructor");

    positionSquares(this.layers, this.options.orientation);
    renderPiecesStatic(this.layers, this.placement, this.options.orientation);
  }

  setPosition(fen: string, _opts?: { animate?: boolean }): void {
    this.applyFen(fen, "setPosition");
    this.pendingMove = null; // any setPosition clears a pending move, per spec
    renderPiecesStatic(this.layers, this.placement, this.options.orientation);
    // `animate` is accepted but ignored until phase 4 (animations).
  }

  getPosition(): string {
    return serializeFen(this.placement, this.rest);
  }

  setOrientation(side: Side, _opts?: { animate?: boolean }): void {
    this.options.orientation = side;
    positionSquares(this.layers, side);
    renderPiecesStatic(this.layers, this.placement, side);
    renderHighlights(this.layers, this.highlights, side); // keep highlights aligned after a flip
    // `animate` is accepted but ignored until phase 4.
  }

  setInteraction(config: Partial<InteractionConfig>): void {
    this.options.interaction = { ...this.options.interaction, ...config };
    // No behavioral effect yet — input.ts (phases 5-6) reads this.
  }

  setHighlights(list: Highlight[]): void {
    this.highlights = list;
    renderHighlights(this.layers, this.highlights, this.options.orientation);
  }

  setOverlays(_list: Overlay[]): void {
    // Not yet stored or rendered — overlays.ts (phase 7) will own this state
    // and draw the SVG content.
  }

  setPendingMove(move: { from: Square; to: Square } | null): void {
    this.pendingMove = move;
    // Does not yet apply the 'pending' highlight tag — wired up in phase 6
    // together with click-to-move, per the phase plan.
  }

  getPendingMove(): { from: Square; to: Square } | null {
    return this.pendingMove;
  }

  clearSelection(): void {
    // No-op until phase 6 — there is no selection state yet.
  }

  destroy(): void {
    destroyLayers(this.root, this.layers);
  }

  private applyFen(fen: string, source: string): void {
    const parsed = parseFen(fen);
    if (parsed.ok) {
      this.placement = parsed.placement;
      this.rest = parsed.rest;
    } else {
      console.warn(`[board-view] invalid FEN passed to ${source}, rendering an empty board: ${parsed.error}`);
      this.placement = new Map();
      this.rest = "";
    }
  }
}
