// Package fixtures loads the static, hand-verified set of legal chess
// puzzles used by the mocked AI generation/analysis layer (see
// specs/001-neuratop-mvp/research.md, "AI generation / chat / engine
// analysis" — a real model is deferred; this keeps FR-017 satisfied by
// construction since every fixture is a real, legal, manually verified
// position rather than fabricated data).
package fixtures

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
)

type Eval struct {
	Evaluation string `json:"evaluation"`
	BestMove   string `json:"bestMove"`
	Depth      int    `json:"depth"`
}

type Puzzle struct {
	ID           string   `json:"id"`
	FEN          string   `json:"fen"`
	SideToMove   string   `json:"sideToMove"`
	Objective    string   `json:"objective"`
	SolutionLine []string `json:"solutionLine"`
	Tag          string   `json:"tag"`
	Description  string   `json:"description"`
	Difficulty   int      `json:"difficulty"`
	SimplifiesTo *string  `json:"simplifiesTo"`
	MockEval     Eval     `json:"mockEval"`
}

// Store is an in-memory, read-only index over the fixture set.
type Store struct {
	byID map[string]Puzzle
	all  []Puzzle
}

func Load(path string) (*Store, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read fixtures file %s: %w", path, err)
	}
	var list []Puzzle
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil, fmt.Errorf("parse fixtures file %s: %w", path, err)
	}
	byID := make(map[string]Puzzle, len(list))
	for _, p := range list {
		byID[p.ID] = p
	}
	return &Store{byID: byID, all: list}, nil
}

// Sample returns up to count fixtures matching tag (case-sensitive exact
// match). If tag is empty, it samples from the whole set. Order is
// randomized so repeated requests with the same inputs don't feel static.
func (s *Store) Sample(tag string, count int) []Puzzle {
	pool := s.all
	if tag != "" {
		pool = make([]Puzzle, 0, len(s.all))
		for _, p := range s.all {
			if p.Tag == tag {
				pool = append(pool, p)
			}
		}
		if len(pool) == 0 {
			// No fixture for this exact tag: fall back to the whole set
			// rather than returning nothing, so the mock always has
			// something plausible to show (documented mock behavior).
			pool = s.all
		}
	}

	shuffled := make([]Puzzle, len(pool))
	copy(shuffled, pool)
	rand.Shuffle(len(shuffled), func(i, j int) { shuffled[i], shuffled[j] = shuffled[j], shuffled[i] })

	if count > len(shuffled) {
		count = len(shuffled)
	}
	return shuffled[:count]
}

func (s *Store) ByID(id string) (Puzzle, bool) {
	p, ok := s.byID[id]
	return p, ok
}

// Simplified returns the fixture that id's SimplifiesTo points to, if any.
func (s *Store) Simplified(id string) (Puzzle, bool) {
	p, ok := s.byID[id]
	if !ok || p.SimplifiesTo == nil {
		return Puzzle{}, false
	}
	return s.ByID(*p.SimplifiesTo)
}
