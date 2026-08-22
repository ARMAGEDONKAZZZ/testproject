-- Tracks how far into puzzles.solution_line a solve_attempts row has
-- progressed. Needed now that solution_line can hold multi-ply sequences
-- (solver move -> forced opponent reply -> solver move -> ...), not just a
-- single winning move: SubmitMove compares against solution_line[solution_index]
-- instead of always solution_line[0], and advances past a forced opponent
-- reply automatically.
ALTER TABLE solve_attempts ADD COLUMN solution_index smallint NOT NULL DEFAULT 0;
