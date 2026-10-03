export interface SolveMove {
  index: number;
  cell: 'snake' | 'empty';
  /** 0 = immediate constraint; 1 = one hypothetical assignment, then forced moves. */
  depth: number;
  reason: string;
}

export interface GenerationInfo {
  version: 3 | 4;
  numberedClueChance?: number;
  seed: string;
  unique: true;
  maxAssumptionDepth: number;
  requiredAssumptionDepth: number;
  forcedMoves: number;
  lookaheadMoves: number;
  solverChecks: number;
  layoutChecks: number;
  clueTrials: number;
  trace: SolveMove[];
}
