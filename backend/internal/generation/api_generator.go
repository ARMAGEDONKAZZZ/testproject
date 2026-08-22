package generation

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/neuratop/backend/internal/puzzleapi"
	"github.com/neuratop/backend/internal/puzzlemodel"
)

// APIGenerator sources puzzles from the external Neuratrap trainer
// recommendation API instead of the local fixture set. The endpoint has no
// filtering query params (confirmed by probing tactic/phase/tag — all
// silently ignored), so inputMode/payload (tag chips, free-text prompts) are
// accepted but have no effect on which puzzle comes back — every call just
// asks the API for its next personalized recommendation.
type APIGenerator struct {
	client *puzzleapi.Client
	repo   *Repository
}

func NewAPIGenerator(client *puzzleapi.Client, repo *Repository) *APIGenerator {
	return &APIGenerator{client: client, repo: repo}
}

func (g *APIGenerator) Generate(ctx context.Context, ownerUserID, generationID uuid.UUID, inputMode, payload string, count int) ([]puzzlemodel.Puzzle, error) {
	if count < 1 {
		count = 1
	}

	puzzles := make([]puzzlemodel.Puzzle, 0, count)
	for i := 0; i < count; i++ {
		rec, err := g.client.Recommend(ctx)
		if err != nil {
			return nil, fmt.Errorf("recommend puzzle %d/%d: %w", i+1, count, err)
		}

		p := puzzlemodel.Puzzle{
			OwnerUserID:  ownerUserID,
			GenerationID: &generationID,
			FEN:          rec.FEN,
			SideToMove:   sideToMoveFromFEN(rec.FEN),
			// solution_line is now UCI plies (solver move, forced opponent
			// reply, solver move, ...) straight from the API's "moves" field
			// rather than the fixtures' single SAN move — see
			// internal/puzzle/service.go SubmitMove, which walks this
			// sequence ply by ply instead of only ever checking index 0.
			SolutionLine:    strings.Fields(rec.Moves),
			Objective:       objectiveFor(rec),
			Tag:             tagFor(rec),
			Description:     descriptionFor(rec),
			Difficulty:      difficultyFor(rec),
			IsVerifiedLegal: true,
		}

		created, err := g.repo.CreatePuzzle(ctx, p)
		if err != nil {
			return nil, err
		}
		puzzles = append(puzzles, created)
	}
	return puzzles, nil
}

// sideToMoveFromFEN reads the active-color field (FEN's 2nd space-separated
// field) — falls back to "white" for a malformed FEN rather than erroring,
// since a bad side-to-move guess is a much smaller failure than rejecting an
// otherwise-usable puzzle outright.
func sideToMoveFromFEN(fen string) string {
	fields := strings.Fields(fen)
	if len(fields) < 2 || fields[1] != "b" {
		return "white"
	}
	return "black"
}

func tagFor(rec *puzzleapi.RecommendedPuzzle) string {
	if rec.Tactic != "" {
		return rec.Tactic
	}
	if rec.Phase != "" {
		return rec.Phase
	}
	return "tactics"
}

func difficultyFor(rec *puzzleapi.RecommendedPuzzle) int16 {
	if rec.PuzzleLevel > 0 {
		return int16(rec.PuzzleLevel)
	}
	return 1
}

// tacticRu/phaseRu translate the API's English tactic/phase vocabulary into
// the short Russian phrases used everywhere else in the app (FR-063: all
// user-facing text is Russian). Only sacrifice/fork/pin have been observed
// from the live API so far; other plausible tactic names are included
// pre-emptively and objectiveFor/descriptionFor both degrade gracefully to a
// generic phrase for anything not in this map, so an unrecognized tactic
// never breaks generation — it just gets less specific Russian copy.
var tacticRu = map[string]string{
	"sacrifice":         "жертва",
	"fork":              "вилка",
	"pin":               "связка",
	"skewer":            "рентген",
	"discovered_attack": "вскрытое нападение",
	"double_attack":     "двойной удар",
	"deflection":        "отвлечение",
	"decoy":             "завлечение",
	"clearance":         "освобождение поля",
	"zugzwang":          "цугцванг",
	"back_rank":         "мат на последней горизонтали",
	"hanging_piece":     "выигрыш фигуры",
	"trapped_piece":     "ловля фигуры",
}

var phaseRu = map[string]string{
	"opening":    "дебют",
	"middlegame": "миттельшпиль",
	"endgame":    "эндшпиль",
}

// russianMoveWord picks the grammatically correct plural form of "ход" for
// "Мат в N ход(а/ов)" — Russian has three plural forms depending on n mod 10/100.
func russianMoveWord(n int) string {
	if n%100 >= 11 && n%100 <= 14 {
		return "ходов"
	}
	switch n % 10 {
	case 1:
		return "ход"
	case 2, 3, 4:
		return "хода"
	default:
		return "ходов"
	}
}

func objectiveFor(rec *puzzleapi.RecommendedPuzzle) string {
	if rec.IsMate && rec.MateIn > 0 {
		return fmt.Sprintf("Мат в %d %s", rec.MateIn, russianMoveWord(rec.MateIn))
	}
	if ru, ok := tacticRu[rec.Tactic]; ok {
		return "Найдите тактический удар: " + ru
	}
	return "Выиграть материал"
}

func descriptionFor(rec *puzzleapi.RecommendedPuzzle) string {
	phase := phaseRu[rec.Phase]
	if phase == "" {
		phase = "партии"
	}
	tactic, ok := tacticRu[rec.Tactic]
	if !ok {
		return fmt.Sprintf("Позиция из %s. Найдите точную последовательность ходов, чтобы получить решающее преимущество.", phase)
	}
	return fmt.Sprintf("Позиция из %s. Мотив: %s — найдите точную последовательность ходов.", phase, tactic)
}
