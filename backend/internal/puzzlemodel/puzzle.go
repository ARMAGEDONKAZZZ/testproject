// Package puzzlemodel holds the Puzzle domain type shared by the generation
// and puzzle packages, so both can read/write the `puzzles` table without
// importing each other (avoids an import cycle between the two).
package puzzlemodel

import (
	"time"

	"github.com/google/uuid"
)

type Puzzle struct {
	ID               uuid.UUID
	OwnerUserID      uuid.UUID
	GenerationID     *uuid.UUID
	FEN              string
	SideToMove       string
	Objective        string
	SolutionLine     []string
	Tag              string
	Description      string
	Difficulty       int16
	SimplifiedFromID *uuid.UUID
	SimplifyDepth    int16
	IsVerifiedLegal  bool
	MockEval         *MockEval
	CreatedAt        time.Time
}

type MockEval struct {
	Evaluation string `json:"evaluation"`
	BestMove   string `json:"bestMove"`
	Depth      int    `json:"depth"`
}

// APIView is the JSON shape returned to clients. SolutionLine is
// deliberately omitted here — handlers decide when it's safe to reveal
// (Constitution III: never leak the answer before it's earned).
type APIView struct {
	ID          uuid.UUID `json:"id"`
	FEN         string    `json:"fen"`
	SideToMove  string    `json:"sideToMove"`
	Objective   string    `json:"objective"`
	Tag         string    `json:"tag"`
	Description string    `json:"description"`
	Difficulty  int16     `json:"difficulty"`
	CreatedAt   time.Time `json:"createdAt"`
}

func (p Puzzle) ToAPIView() APIView {
	return APIView{
		ID:          p.ID,
		FEN:         p.FEN,
		SideToMove:  p.SideToMove,
		Objective:   p.Objective,
		Tag:         p.Tag,
		Description: p.Description,
		Difficulty:  p.Difficulty,
		CreatedAt:   p.CreatedAt,
	}
}
