// Copyright (c) 2026 Neuratop. All rights reserved.
//
// DOM layer creation/mounting: the five-layer stack (board, highlights,
// pieces, overlays, dragged), bottom to top, plus static rendering of
// squares/pieces/highlights into them. No animation, no input handling —
// see position.ts for the diffing later phases will animate, and input.ts
// (phase 5) for pointer handling.

import { indexToRenderCell, indexToSquare, squareToIndex } from "./geometry";
import { pieceFallbackGlyph } from "./pieces-fallback";
import type { PositionMap } from "./position";
import type { Highlight, Piece, Side, Square } from "./types";

export interface BoardLayers {
  boardLayer: HTMLDivElement;
  highlightsLayer: HTMLDivElement;
  piecesLayer: HTMLDivElement;
  overlaysLayer: SVGSVGElement;
  draggedLayer: HTMLDivElement;
  squareElements: Map<Square, HTMLDivElement>;
}

const SVG_NS = "http://www.w3.org/2000/svg";

export function createLayers(root: HTMLElement): BoardLayers {
  root.classList.add("bv-root");

  const boardLayer = document.createElement("div");
  boardLayer.className = "bv-layer bv-layer--board";

  const highlightsLayer = document.createElement("div");
  highlightsLayer.className = "bv-layer bv-layer--highlights";

  const piecesLayer = document.createElement("div");
  piecesLayer.className = "bv-layer bv-layer--pieces";

  const overlaysLayer = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  overlaysLayer.setAttribute("class", "bv-layer bv-layer--overlays");
  overlaysLayer.setAttribute("viewBox", "0 0 8 8");
  overlaysLayer.setAttribute("preserveAspectRatio", "none");

  const draggedLayer = document.createElement("div");
  draggedLayer.className = "bv-layer bv-layer--dragged";

  const squareElements = new Map<Square, HTMLDivElement>();
  for (let index = 0; index < 64; index++) {
    const square = indexToSquare(index);
    const el = document.createElement("div");
    el.className = `bv-square ${isLightSquare(index) ? "bv-square--light" : "bv-square--dark"}`;
    el.dataset.square = square;
    squareElements.set(square, el);
    boardLayer.appendChild(el);
  }

  root.append(boardLayer, highlightsLayer, piecesLayer, overlaysLayer, draggedLayer);

  return { boardLayer, highlightsLayer, piecesLayer, overlaysLayer, draggedLayer, squareElements };
}

export function destroyLayers(root: HTMLElement, layers: BoardLayers): void {
  layers.boardLayer.remove();
  layers.highlightsLayer.remove();
  layers.piecesLayer.remove();
  layers.overlaysLayer.remove();
  layers.draggedLayer.remove();
  layers.squareElements.clear();
  root.classList.remove("bv-root", "bv-show-coordinates");
}

function isLightSquare(index: number): boolean {
  const file = index % 8;
  const rank = Math.floor(index / 8);
  return (file + rank) % 2 === 1; // a1 (file 0, rank 0) is dark, matching real boards
}

function translateFor(index: number, orientation: Side): string {
  const { col, row } = indexToRenderCell(index, orientation);
  return `translate(${col * 100}%, ${row * 100}%)`;
}

/**
 * Repositions the 64 permanent square elements for the given orientation,
 * and recomputes which edge squares carry a coordinate label (rule:
 * coordinates render via CSS pseudo-elements off a data attribute, never
 * as separate DOM nodes — visibility itself is gated by the
 * bv-show-coordinates class on root, toggled once at construction).
 */
export function positionSquares(layers: BoardLayers, orientation: Side): void {
  for (let index = 0; index < 64; index++) {
    const square = indexToSquare(index);
    const el = layers.squareElements.get(square);
    if (!el) continue;

    const { col, row } = indexToRenderCell(index, orientation);
    el.style.transform = `translate(${col * 100}%, ${row * 100}%)`;

    if (row === 7) {
      el.dataset.fileLabel = square[0];
    } else {
      delete el.dataset.fileLabel;
    }
    if (col === 0) {
      el.dataset.rankLabel = square[1];
    } else {
      delete el.dataset.rankLabel;
    }
  }
}

/**
 * Full, non-animated (re)render of every occupied square's piece element.
 * Phase 4 adds diff-based element reuse and CSS-transition animation on
 * top of this same layer.
 */
export function renderPiecesStatic(layers: BoardLayers, placement: PositionMap, orientation: Side): void {
  layers.piecesLayer.replaceChildren();
  for (const [square, piece] of placement) {
    const el = createPieceElement(piece);
    el.style.transform = translateFor(squareToIndex(square), orientation);
    layers.piecesLayer.appendChild(el);
  }
}

function createPieceElement(piece: Piece): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `bv-piece bv-${piece.color}${piece.kind}`;
  el.textContent = pieceFallbackGlyph(piece);
  return el;
}

/**
 * Full (re)render of the highlights layer. Colors come entirely from
 * `bv-highlight--{tag}`, defined by the host's own CSS — no hardcoded
 * colors here, per spec.
 */
export function renderHighlights(layers: BoardLayers, highlights: Highlight[], orientation: Side): void {
  layers.highlightsLayer.replaceChildren();
  for (const { square, tag } of highlights) {
    const el = document.createElement("div");
    el.className = `bv-highlight bv-highlight--${tag}`;
    el.style.transform = translateFor(squareToIndex(square), orientation);
    layers.highlightsLayer.appendChild(el);
  }
}
