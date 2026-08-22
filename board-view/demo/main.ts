// Copyright (c) 2026 Neuratop. All rights reserved.

import { BoardView } from "../src/core/BoardView";
import "../src/styles/board.css";

const boardRoot = document.querySelector<HTMLDivElement>("#board");
if (!boardRoot) {
  throw new Error("missing #board element");
}

const board = new BoardView(boardRoot, {
  position: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
});

let orientation: "white" | "black" = "white";

document.querySelector<HTMLButtonElement>("#flip")?.addEventListener("click", () => {
  orientation = orientation === "white" ? "black" : "white";
  board.setOrientation(orientation);
});

document.querySelector<HTMLFormElement>("#fen-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.querySelector<HTMLInputElement>("#fen-input");
  if (input?.value) {
    board.setPosition(input.value);
  }
});

document.querySelector<HTMLButtonElement>("#highlight-e4")?.addEventListener("click", () => {
  board.setHighlights([{ square: "e4", tag: "demo" }]);
});

document.querySelector<HTMLButtonElement>("#clear-highlights")?.addEventListener("click", () => {
  board.setHighlights([]);
});

const positionOutput = document.querySelector<HTMLElement>("#position-output");
document.querySelector<HTMLButtonElement>("#log-position")?.addEventListener("click", () => {
  if (positionOutput) {
    positionOutput.textContent = board.getPosition();
  }
});
