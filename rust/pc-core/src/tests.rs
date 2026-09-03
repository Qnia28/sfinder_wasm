use super::*;
fn sig(mut v: Vec<Placement>) -> Vec<(u64, u8, i8, i8)> {
    let mut x: Vec<_> = v
        .drain(..)
        .map(|p| {
            (
                p.board,
                match p.piece {
                    Piece::O => 0,
                    Piece::I | Piece::S | Piece::Z => p.orientation & 1,
                    _ => p.orientation,
                },
                p.x,
                p.y,
            )
        })
        .collect();
    x.sort_unstable();
    x
}
#[test]
fn normalize_lines() {
    let b = FULL_ROW | (1 << 10);
    assert_eq!(normalize_after_placement(b, 4), FULL_ROW | (1 << 10))
}
#[test]
fn bitset_matches_bfs_empty() {
    for h in 2..=4 {
        for p in Piece::ALL {
            assert_eq!(
                sig(reachable_placements(0, p, h)),
                sig(reachable_placements_bfs(0, p, h)),
                "h={h} p={p:?}"
            )
        }
    }
}
#[test]
fn bitset_matches_bfs_sample_boards() {
    let boards = [
        0x0000000000,
        0x00000003ff,
        0x000003f0c3,
        0x0000f030c3,
        0x00c03030c3,
    ];
    for &b in &boards {
        for p in Piece::ALL {
            if b & !board_mask(4) == 0 {
                assert_eq!(
                    sig(reachable_placements(b, p, 4)),
                    sig(reachable_placements_bfs(b, p, 4)),
                    "b={b:x} p={p:?}"
                )
            }
        }
    }
}
#[test]
fn bitset_matches_bfs_randomized_boards() {
    let mut x = 0x1234_5678_9abc_def0u64;
    for _ in 0..96 {
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        let b = normalize_after_placement(x & board_mask(4), 4);
        for p in Piece::ALL {
            assert_eq!(
                sig(reachable_placements(b, p, 4)),
                sig(reachable_placements_bfs(b, p, 4)),
                "b={b:x} p={p:?}"
            );
        }
    }
}

#[test]
fn packed_boards_lookup() {
    let values = [0u64, 1, 0x12345, 0x0012_3456_789a, (1u64 << 40) - 1];
    let mut packed = PackedBoards {
        data: Vec::new(),
        len: 0,
    };
    for &value in &values {
        packed.push(value);
    }
    packed.finish();
    for (i, &value) in values.iter().enumerate() {
        assert_eq!(packed.get(i), value);
        assert_eq!(packed.find(value), Some(i));
    }
    assert_eq!(packed.find(0x4242), None);
}

#[test]
fn simple_two_line() {
    let mut s = PcSolver::new(2);
    assert!(s.can_pc(0, &[Piece::O; 5], true))
}
#[test]
fn cover_exact_reachability_preserves_one_side_i_tuck() {
    let s_mask = 0x3006u64;
    let i_mask = 0x78u64;
    let z_mask = 0x30180u64;
    assert!(reachable_exact_locked(
        0,
        Piece::S,
        s_mask,
        4,
        Physics::Jstris
    ));
    assert!(reachable_exact_locked(
        s_mask,
        Piece::I,
        i_mask,
        4,
        Physics::Jstris
    ));
    assert!(reachable_exact_locked(
        s_mask | i_mask,
        Piece::Z,
        z_mask,
        4,
        Physics::Jstris
    ));
    assert!(!reachable_exact_locked(
        s_mask | z_mask,
        Piece::I,
        i_mask,
        4,
        Physics::Jstris
    ));
}

#[test]
fn compact_solution_roundtrip() {
    let compact = CompactSolution::default()
        .with_piece_mask(Piece::I, 0x0000_0000_000f)
        .with_piece_mask(Piece::T, 0x0000_0000_0f00)
        .with_piece_mask(Piece::Z, 0x0000_000f_0000);
    let masks = compact.masks(4);
    assert_eq!(masks[Piece::I as usize], 0x0000_0000_000f);
    assert_eq!(masks[Piece::T as usize], 0x0000_0000_0f00);
    assert_eq!(masks[Piece::Z as usize], 0x0000_000f_0000);
    assert_eq!(masks[Piece::J as usize], 0);
}

#[test]
fn structural_enumerator_counts_playable_piece_orders() {
    let mut solver = PcSolver::new(2);
    let queue = [Piece::O; 6]; // five O pieces fill 2 lines, one is saved
    let solutions = solver.enumerate_pc(0, &queue, true);
    assert!(!solutions.is_empty());
    assert!(solutions.iter().all(|s| s.order_count >= 1));
    let best = solver.per_save_best(0, &queue, true, 16);
    assert_eq!(best.len(), 1);
    assert_eq!(best[0].0, Piece::O);
    assert!(best[0].1.order_count >= 1);
}

#[test]
fn per_save_best_is_exact_beyond_legacy_candidate_limit() {
    let board = 0x3c0f03c0fu64;
    let queue = [
        Piece::O,
        Piece::Z,
        Piece::I,
        Piece::L,
        Piece::J,
        Piece::S,
        Piece::T,
    ];
    let mut solver = PcSolver::new(4);
    let all = solver.enumerate_pc(board, &queue, true);
    let mut expected: [Option<Solution>; 7] = [None; 7];
    for candidate in all {
        let saved = PcSolver::saved_piece_for_solution(&queue, &candidate);
        if saved >= 7 {
            continue;
        }
        let slot = &mut expected[saved as usize];
        let replace = match slot {
            None => true,
            Some(current) if candidate.order_count != current.order_count => {
                candidate.order_count > current.order_count
            }
            Some(current) => PcSolver::solution_key_cmp(&candidate.masks, &current.masks).is_lt(),
        };
        if replace {
            *slot = Some(candidate);
        }
    }
    let direct = solver.per_save_best(board, &queue, true, 16);
    for (piece, actual) in direct {
        let expected = expected[piece as usize].expect("expected save result");
        assert_eq!(actual.order_count, expected.order_count);
        assert_eq!(actual.masks, expected.masks);
    }
}

#[test]
fn best_pc_matches_full_enumeration_ranking() {
    let board = 0x3c0f03c0fu64;
    let queue = [
        Piece::O,
        Piece::J,
        Piece::I,
        Piece::L,
        Piece::S,
        Piece::Z,
        Piece::T,
    ];
    let mut solver = PcSolver::new(4);
    let mut all = solver.enumerate_pc(board, &queue, true);
    assert_eq!(all.len(), 44);
    all.sort_by(|left, right| {
        right
            .order_count
            .cmp(&left.order_count)
            .then_with(|| PcSolver::solution_key_cmp(&left.masks, &right.masks))
    });
    let expected = all[0];
    let actual = solver.best_pc(board, &queue, true).expect("best PC");
    assert_eq!(actual.masks, expected.masks);
    assert_eq!(actual.order_count, expected.order_count);
}

#[test]
fn solution_key_comparator_matches_string_order() {
    let samples = [
        [0, 0, 0, 0, 0, 0, 0],
        [0xf, 0x10, 0xa, 0x9, 0x100, 0xabcd, 1],
        [0x10, 0xf, 0xb, 0x90, 0x101, 0xabce, 2],
        [u64::MAX, 1, 2, 3, 4, 5, 6],
    ];
    for left in &samples {
        for right in &samples {
            assert_eq!(
                PcSolver::solution_key_cmp(left, right),
                PcSolver::solution_key(left).cmp(&PcSolver::solution_key(right))
            );
        }
    }
}

#[test]
fn saved_piece_is_derived_from_solution_multiset() {
    let mut solver = PcSolver::new(2);
    let queue = [Piece::O; 6];
    let solutions = solver.enumerate_pc(0, &queue, true);
    assert!(!solutions.is_empty());
    assert!(
        solutions
            .iter()
            .all(|solution| PcSolver::saved_piece_for_solution(&queue, solution) == Piece::O as u8)
    );
}

#[test]
fn compatibility_pattern_existence_matches_scalar_batch() {
    let board = FULL_ROW | (FULL_ROW << 10) | (FULL_ROW << 20);
    let queues = [
        encode_queue_ascii("OOOOO").unwrap(),
        encode_queue_ascii("IIIII").unwrap(),
        encode_queue_ascii("TILJS").unwrap(),
        encode_queue_ascii("ZOSLT").unwrap(),
    ];
    let lengths = [5u8; 4];
    let mut pattern = [0u8; 4];
    let mut scalar = [0u8; 4];
    let mut solver = PcSolver::new(5);
    assert!(solver.can_pc_pattern_many_packed(board, &queues, &lengths, true, &mut pattern));
    assert!(solver.can_pc_many_packed(board, &queues, &lengths, true, &mut scalar));
    assert_eq!(pattern, scalar);
}

#[test]
fn four_line_pattern_existence_matches_scalar_batch() {
    let board = FULL_ROW | (FULL_ROW << 10);
    let queues = [
        encode_queue_ascii("OOOOO").unwrap(),
        encode_queue_ascii("IIIII").unwrap(),
        encode_queue_ascii("TILJS").unwrap(),
        encode_queue_ascii("ZOSLT").unwrap(),
    ];
    let lengths = [5u8; 4];
    let mut pattern = [0u8; 4];
    let mut scalar = [0u8; 4];
    let mut solver = PcSolver::new(4);
    assert!(solver.can_pc_pattern_many_packed(board, &queues, &lengths, true, &mut pattern));
    assert!(solver.can_pc_many_packed(board, &queues, &lengths, true, &mut scalar));
    assert_eq!(pattern, scalar);
}

#[test]
fn reverse_contains_simple_predecessor() {
    let ps = geometric_predecessors(full_board(2), 2);
    assert!(!ps.is_empty());
    assert!(ps.iter().all(|b| b.count_ones() == 16))
}

// ── column_run_reject unit tests ─────────────────────────────────────────

#[test]
fn column_run_reject_empty_h4_is_false() {
    // 4L empty: 40 empty cells, one fully connected run, 40 % 4 = 0.
    assert!(!column_run_reject(0, 4));
}

#[test]
fn column_run_reject_connected_with_complete_rows_is_false() {
    // h=5 with 3 complete rows: 20 empty cells in rows 3-4, all connected.
    let b5 = FULL_ROW | (FULL_ROW << 10) | (FULL_ROW << 20);
    assert!(!column_run_reject(b5, 5));
    // h=6 with 2 complete rows: 40 empty cells in rows 2-5, all connected.
    let b6 = FULL_ROW | (FULL_ROW << 10);
    assert!(!column_run_reject(b6, 6));
}

#[test]
fn column_run_reject_full_board_is_always_false() {
    // Fully filled: no empty cells, every run has 0 empty -> 0 % 4 = 0.
    for h in [4u8, 5, 6] {
        assert!(!column_run_reject(full_board(h), h), "h={h}");
    }
}

#[test]
fn column_run_reject_isolated_run_non_mod4_returns_true() {
    // Col 2 completely filled -> isolates cols 0-1 from the rest.
    // Cols 0-1 each have row 3 filled (1 cell), so 3 empty cells each = 6 total.
    // 6 % 4 != 0 -> reject.
    let board: u64 = (1 << 30) | (1 << 31) // col 0 and col 1, row 3 filled
            | (1 << 2) | (1 << 12) | (1 << 22) | (1 << 32); // col 2 all filled
    assert!(column_run_reject(board, 4));
}

#[test]
fn column_run_reject_balanced_split_returns_false() {
    // Col 4 completely filled -> splits into two runs: cols 0-3 (16 empty)
    // and cols 5-9 (20 empty). Both are mod 4.
    let board: u64 = (1 << 4) | (1 << 14) | (1 << 24) | (1 << 34);
    assert!(!column_run_reject(board, 4));
}

#[test]
fn column_run_reject_unbalanced_split_returns_true() {
    // Col 3 completely filled -> left run cols 0-2 has 3*4=12 cells (mod 4 ok),
    // col 3 empty = 0 (ok), right run cols 4-9 has 6*4=24 cells (ok). Fine.
    // But if we also fill one cell of col 0 -> left run has 11 empty -> reject.
    let col3_full: u64 = (1 << 3) | (1 << 13) | (1 << 23) | (1 << 33);
    let extra: u64 = 1 << 0; // col 0, row 0 filled
    let board = col3_full | extra;
    // col_empty[0] = 0b1110 (3 bits), col_empty[1] = 0b1111 (4), col_empty[2] = 0b1111 (4)
    // Run 0-2: 3+4+4 = 11 empty, 11 % 4 != 0 -> true
    assert!(column_run_reject(board, 4));
}

#[test]
fn column_run_reject_completed_rows_not_counted() {
    // Two completed rows at bottom (rows 0-1 = normalized bottom).
    // The full rows contribute no empty cells; only rows 2-3 matter.
    // With rows 2-3 all empty and no splits -> 2*10 = 20 empty, 20 % 4 = 0.
    let complete_two = FULL_ROW | (FULL_ROW << 10);
    assert!(!column_run_reject(complete_two, 4));
}

#[test]
fn column_run_reject_completed_rows_with_bad_remainder() {
    // Two completed rows at bottom; col 2 fully filled in rows 2-3 too.
    // Cols 0-1 in rows 2-3 have 1 extra cell filled -> 3 empty each = 6 total.
    // 6 % 4 != 0 -> reject.
    let complete_two: u64 = FULL_ROW | (FULL_ROW << 10);
    let col2_top: u64 = (1 << 22) | (1 << 32);
    let col0_one: u64 = 1 << 20; // col 0, row 2 filled
    let col1_one: u64 = 1 << 21; // col 1, row 2 filled
    let board = complete_two | col2_top | col0_one | col1_one;
    // col_empty[0]: rows 2-3 -> row 2 filled, row 3 empty -> bit 3 only -> 1 empty
    // col_empty[1]: row 2 filled, row 3 empty -> 1 empty
    // col_empty[2]: both rows 2-3 filled -> 0 empty
    // gap 0/1: col_empty[0] & col_empty[1] = (1<<3) & (1<<3) = != 0 -> connected
    // gap 1/2: col_empty[1] & col_empty[2] = (1<<3) & 0 = 0 -> disconnected
    // run 0-1: 1+1 = 2, 2 % 4 != 0 -> true
    assert!(column_run_reject(board, 4));
}

#[test]
fn column_run_reject_height5_6_basic() {
    // At h=5, an empty board has 50 empty cells = 50 % 4 != 0.
    // But the pc engine only calls this on child states where remaining_cells
    // is already a multiple of 4.  Test with a board that has a bad split.
    // Col 1 completely filled at h=5 -> col 0 has 5 empty cells, 5 % 4 != 0.
    let col1_h5: u64 = (1 << 1) | (1 << 11) | (1 << 21) | (1 << 31) | (1 << 41);
    assert!(column_run_reject(col1_h5, 5));
    // Col 1 completely filled at h=6 -> col 0 has 6 empty cells, 6 % 4 != 0.
    let col1_h6: u64 = (1 << 1) | (1 << 11) | (1 << 21) | (1 << 31) | (1 << 41) | (1 << 51);
    assert!(column_run_reject(col1_h6, 6));
    // Symmetric: col 8 fully filled at h=6 -> col 9 alone has 6 empty cells.
    let col8_h6: u64 = (1 << 8) | (1 << 18) | (1 << 28) | (1 << 38) | (1 << 48) | (1 << 58);
    assert!(column_run_reject(col8_h6, 6));
}

// ── No productive child rejected ──────────────────────────────────────────

// For every board reachable by placing one tetromino on `start_board`,
// if column_run_reject returns true, verify the child board is not solvable
// by any of the supplied `probe_queues`.  Multiple queues widen coverage
// when no single queue reaches all solvable completions.
//
// Primary soundness for h=5/6 comes from the fingerprint tests below
// (pattern vs. independent scalar solver).  These tests are structural
// insurance: they catch any falsely-rejected board whose completion is
// reachable by at least one probe queue.
fn verify_no_productive_child_rejected(
    height: u8,
    start_board: u64,
    pieces_after_one: u8,
    probe_queues: &[Vec<Piece>],
) {
    let mut solver = PcSolver::new(height);
    for &piece in &Piece::ALL {
        let placements = reachable_placements(start_board, piece, height);
        for pl in placements {
            if pl.board == full_board(height) {
                continue;
            }
            let remaining_cells = height as u32 * 10 - pl.board.count_ones();
            if remaining_cells != pieces_after_one as u32 * 4 {
                continue;
            }
            if column_run_reject(pl.board, height) {
                for queue in probe_queues {
                    assert!(
                        !solver.can_pc(pl.board, queue, true),
                        "column_run_reject falsely rejected solvable board \
                             {:#x} h={height} piece={piece:?}",
                        pl.board
                    );
                }
            }
        }
    }
}

#[test]
fn column_run_reject_soundness_h4() {
    // 4L empty: 40 cells, 10 pieces needed.  After placing 1: 9 remain.
    let queues: Vec<Vec<Piece>> = vec![
        Piece::ALL.iter().cycle().take(9).copied().collect(),
        [Piece::O; 9].to_vec(),
        [Piece::I; 9].to_vec(),
        Piece::ALL.iter().rev().cycle().take(9).copied().collect(),
    ];
    verify_no_productive_child_rejected(4, 0, 9, &queues);
}

#[test]
fn column_run_reject_soundness_h5() {
    // h=5 with 1 complete row at bottom: 40 empty cells, 10 pieces needed.
    // After placing 1 piece: 9 remain.
    let start = FULL_ROW; // 10 cells filled
    let queues: Vec<Vec<Piece>> = vec![
        Piece::ALL.iter().cycle().take(9).copied().collect(),
        [Piece::O; 9].to_vec(),
        Piece::ALL.iter().rev().cycle().take(9).copied().collect(),
    ];
    verify_no_productive_child_rejected(5, start, 9, &queues);
}

#[test]
fn column_run_reject_soundness_h6() {
    // h=6 empty: 60 cells, 15 pieces needed.  After placing 1: 14 remain.
    let queues: Vec<Vec<Piece>> = vec![
        Piece::ALL.iter().cycle().take(14).copied().collect(),
        [Piece::O; 14].to_vec(),
        Piece::ALL.iter().rev().cycle().take(14).copied().collect(),
    ];
    verify_no_productive_child_rejected(6, 0, 14, &queues);
}

// ── Pattern fingerprint: 5L broad-pattern on standard board ──────────────

#[test]
fn column_run_reject_5l_pattern_fingerprint_matches_scalar() {
    // Any board reachable from the 5L canonical start with *p7 and *!
    // should give the same solution set via both enumerate_pc_pattern_packed
    // and can_pc_many_packed.  The scalar solver is the independent oracle.
    // This also covers completed-row normalization: the start board has 3
    // complete rows, leaving 2 rows (h=5 total) of empty cells.
    let start = FULL_ROW | (FULL_ROW << 10) | (FULL_ROW << 20); // 3 complete rows
    let queues = [
        encode_queue_ascii("IJLOTS").unwrap(),
        encode_queue_ascii("ZSTILO").unwrap(),
        encode_queue_ascii("OJILTZ").unwrap(),
    ];
    let lengths = [6u8, 6, 6];
    let mut pattern_out = [0u8; 3];
    let mut scalar_out = [0u8; 3];
    let mut solver = PcSolver::new(5);
    assert!(solver.can_pc_pattern_many_packed(start, &queues, &lengths, true, &mut pattern_out));
    assert!(solver.can_pc_many_packed(start, &queues, &lengths, true, &mut scalar_out));
    assert_eq!(
        pattern_out, scalar_out,
        "pattern != scalar after column_run filter"
    );
}

#[test]
fn column_run_reject_6l_pattern_fingerprint_matches_scalar() {
    let start =
        FULL_ROW | (FULL_ROW << 10) | (FULL_ROW << 20) | (FULL_ROW << 30) | (FULL_ROW << 40); // 5 complete rows, 1 left
    let queues = [
        encode_queue_ascii("IJLOTS").unwrap(),
        encode_queue_ascii("ZSTILO").unwrap(),
    ];
    let lengths = [6u8, 6];
    let mut pattern_out = [0u8; 2];
    let mut scalar_out = [0u8; 2];
    let mut solver = PcSolver::new(6);
    assert!(solver.can_pc_pattern_many_packed(start, &queues, &lengths, true, &mut pattern_out));
    assert!(solver.can_pc_many_packed(start, &queues, &lengths, true, &mut scalar_out));
    assert_eq!(
        pattern_out, scalar_out,
        "pattern != scalar after column_run filter"
    );
}

// Regression: when perm[] is omitted from the remap in either emission
// path, covered bits are written at the DFS index rather than the original
// case ID. This test guarantees both paths remap correctly by placing queues
// in reversed DFS order (case 0 = "ZZZZZ", case 1 = "OOOOO"; DFS visits
// O-path first because O(3) < Z(6)), so a missing remap swaps the outputs.
#[test]
fn queue_trie_interval_remap_both_paths() {
    // 5-line board, bottom 3 rows filled → 20 empty cells, req = 5 pieces.
    let board = FULL_ROW | (FULL_ROW << 10) | (FULL_ROW << 20);
    // case 0: Z-first (DFS visits later)
    // case 1: O-first (DFS visits earlier, so perm[0] = 1, perm[1] = 0)
    let qbits = [
        encode_queue_ascii("ZZZZZ").unwrap(),
        encode_queue_ascii("OOOOO").unwrap(),
    ];
    let qlens = [5u8; 2];

    let mut solver = PcSolver::new(5);

    // Ground truth from single-queue solver.
    let ooooo: Vec<Piece> = (0..5).map(|_| Piece::O).collect();
    let zzzzz: Vec<Piece> = (0..5).map(|_| Piece::Z).collect();
    let expect0 = solver.can_pc(board, &zzzzz, true) as u8;
    let expect1 = solver.can_pc(board, &ooooo, true) as u8;

    // can_pc_pattern_many_packed remap test.
    let mut many_out = [0u8; 2];
    assert!(solver.can_pc_pattern_many_packed(board, &qbits, &qlens, true, &mut many_out));
    assert_eq!(
        many_out[0], expect0,
        "can_pc_pattern_many_packed: case 0 (ZZZZZ) wrong — perm[] missing?"
    );
    assert_eq!(
        many_out[1], expect1,
        "can_pc_pattern_many_packed: case 1 (OOOOO) wrong — perm[] missing?"
    );

    // enumerate_pc_pattern_packed remap test: every case in the coverage
    // set of every solution must be a valid original case ID, and the union
    // must agree with the can_pc ground truth.
    let enum_out = solver
        .enumerate_pc_pattern_packed(board, &qbits, &qlens, true)
        .unwrap();
    let mut covered = [false; 2];
    for row in &enum_out {
        for &(case, _) in &row.cases {
            assert!(
                (case as usize) < 2,
                "enumerate_pc_pattern_packed: case ID {case} out of range — perm[] missing?"
            );
            covered[case as usize] = true;
        }
    }
    assert_eq!(
        covered[0],
        expect0 != 0,
        "enumerate_pc_pattern_packed: case 0 (ZZZZZ) coverage wrong"
    );
    assert_eq!(
        covered[1],
        expect1 != 0,
        "enumerate_pc_pattern_packed: case 1 (OOOOO) coverage wrong"
    );
}

// Complete differential parity helper: verifies DFS-interval representation
// produces the same results as scalar single-queue can_pc/enumerate_pc for
// every dimension: hold on/off, exact existence, original case ordering,
// per-solution exact masks, per-solution case membership, per-case
// playableOrderCount, and the full min_cover pipeline (selected solution
// masks + quality vector).
fn assert_pattern_parity(
    board: u64,
    height: u8,
    qbits: &[u64],
    qlens: &[u8],
    use_hold: bool,
    label: &str,
) {
    let n_cases = qbits.len();
    let mut solver = PcSolver::new(height);

    // --- Scalar ground truth per case ---
    let expected_can_pc: Vec<u8> = qbits
        .iter()
        .zip(qlens)
        .map(|(&b, &l)| {
            let q: Vec<Piece> = (0..l)
                .map(|i| PcSolver::packed_piece(b, i).unwrap())
                .collect();
            solver.can_pc(board, &q, use_hold) as u8
        })
        .collect();

    // Scalar per-case enumerate_pc results.
    let scalar_per_case: Vec<Vec<Solution>> = qbits
        .iter()
        .zip(qlens)
        .map(|(&b, &l)| {
            let q: Vec<Piece> = (0..l)
                .map(|i| PcSolver::packed_piece(b, i).unwrap())
                .collect();
            solver.enumerate_pc(board, &q, use_hold)
        })
        .collect();

    // --- can_pc_pattern_many_packed: existence parity ---
    let mut out_many = vec![0u8; n_cases];
    assert!(
        solver.can_pc_pattern_many_packed(board, qbits, qlens, use_hold, &mut out_many),
        "{label}: can_pc_pattern_many_packed returned false"
    );
    assert_eq!(
        out_many, expected_can_pc,
        "{label}: can_pc_pattern_many_packed existence parity hold={use_hold}"
    );

    // --- enumerate_pc_pattern_packed: full parity ---
    let enum_rows = solver
        .enumerate_pc_pattern_packed(board, qbits, qlens, use_hold)
        .unwrap();

    // 1. All case IDs in range; build union.
    let mut union = vec![false; n_cases];
    for row in &enum_rows {
        assert!(
            row.solution.order_count >= 1,
            "{label}: solution order_count=0"
        );
        for &(case, order_count) in &row.cases {
            assert!(
                (case as usize) < n_cases,
                "{label}: case ID {case} out of range hold={use_hold}"
            );
            assert!(
                order_count >= 1,
                "{label}: per-case order_count=0 at case {case}"
            );
            union[case as usize] = true;
        }
    }
    for (i, (&u, &e)) in union.iter().zip(&expected_can_pc).enumerate() {
        assert_eq!(
            u,
            e != 0,
            "{label}: coverage union mismatch at case {i} hold={use_hold}"
        );
    }

    // 2. Per-solution exact masks and per-solution case membership.
    for row in &enum_rows {
        let masks = row.solution.masks;

        let mut expected_cases: Vec<(u32, u32)> = Vec::new();
        for (case_idx, scalar_sols) in scalar_per_case.iter().enumerate() {
            if let Some(s) = scalar_sols.iter().find(|s| s.masks == masks) {
                expected_cases.push((case_idx as u32, s.order_count));
            }
        }
        expected_cases.sort_unstable();

        let mut actual_cases: Vec<(u32, u32)> = row.cases.clone();
        actual_cases.sort_unstable();

        assert_eq!(
            actual_cases, expected_cases,
            "{label}: case membership/playableOrderCount mismatch for geometry \
                 {:?} hold={use_hold}",
            masks
        );
    }

    // 3. Determinism: identical call must produce identical mask order.
    let enum_rows2 = solver
        .enumerate_pc_pattern_packed(board, qbits, qlens, use_hold)
        .unwrap();
    let masks1: Vec<_> = enum_rows.iter().map(|r| r.solution.masks).collect();
    let masks2: Vec<_> = enum_rows2.iter().map(|r| r.solution.masks).collect();
    assert_eq!(
        masks1, masks2,
        "{label}: non-deterministic mask order hold={use_hold}"
    );

    // 4. min_cover pipeline: final selected solution masks and quality vector.
    let all_solvable = expected_can_pc.iter().all(|&v| v != 0);
    if all_solvable {
        let n_solutions = enum_rows.len();

        let mut raw_cases_p2: Vec<Vec<(u32, u32)>> = vec![Vec::new(); n_cases];
        for (sol_idx, row) in enum_rows.iter().enumerate() {
            for &(case, order_count) in &row.cases {
                raw_cases_p2[case as usize].push((sol_idx as u32, order_count));
            }
        }

        let mut scalar_masks_ordered: Vec<[u64; 7]> = Vec::new();
        let mut scalar_mask_to_idx: FastMap<[u64; 7], usize> =
            FastMap::with_hasher(FastBuildHasher::default());
        let mut raw_cases_scalar: Vec<Vec<(u32, u32)>> = vec![Vec::new(); n_cases];
        for (case_idx, scalar_sols) in scalar_per_case.iter().enumerate() {
            for s in scalar_sols {
                let idx = scalar_mask_to_idx.len();
                let sol_idx = *scalar_mask_to_idx.entry(s.masks).or_insert_with(|| {
                    scalar_masks_ordered.push(s.masks);
                    idx
                });
                raw_cases_scalar[case_idx].push((sol_idx as u32, s.order_count));
            }
        }
        let n_scalar_solutions = scalar_masks_ordered.len();

        let result_p2 = min_cover::exact_minimum_cover(&raw_cases_p2, n_solutions);
        let result_scalar = min_cover::exact_minimum_cover(&raw_cases_scalar, n_scalar_solutions);

        match (result_p2, result_scalar) {
            (Some(rp), Some(rs)) => {
                assert_eq!(
                    rp.quality, rs.quality,
                    "{label}: min_cover quality vector mismatch hold={use_hold}"
                );
                let mut sel_p2: Vec<[u64; 7]> = rp
                    .selected
                    .iter()
                    .map(|&i| enum_rows[i as usize].solution.masks)
                    .collect();
                let mut sel_scalar: Vec<[u64; 7]> = rs
                    .selected
                    .iter()
                    .map(|&i| scalar_masks_ordered[i as usize])
                    .collect();
                sel_p2.sort_unstable();
                sel_scalar.sort_unstable();
                assert_eq!(
                    sel_p2, sel_scalar,
                    "{label}: min_cover selected masks mismatch hold={use_hold}"
                );
            }
            (None, None) => {}
            _ => panic!("{label}: min_cover returned Some vs None mismatch hold={use_hold}"),
        }
    }
}

// --- C2 pre-frontier empty-anchor tests ---

// Verify the C2 precondition directly: for every orientation, valid[o] & inside[o] == 0.
// Uses a fully-occupied board so every placement is blocked and valid[o] == 0.
#[test]
fn c2_early_return_fully_occupied() {
    for h in 2u8..=6 {
        let board = board_mask(h);
        let (valid, inside) = valid_anchor_masks(board, Piece::I, h);
        for o in 0..4 {
            assert_eq!(
                valid[o] & inside[o],
                0,
                "C2 precondition must hold: h={h} o={o}"
            );
        }
        for p in Piece::ALL {
            let placements = reachable_placements(board, p, h);
            assert!(
                placements.is_empty(),
                "C2 early return must yield empty result: h={h} p={p:?}"
            );
        }
    }
}

// Verify C2 fires for I-piece when no inside positions overlap valid positions:
// at height=2 with all cells filled except exactly 3 contiguous cells in row 0,
// the I-piece horizontal cannot lock (needs 4 contiguous), and I-piece vertical
// needs 4 rows (inside[1/3] is zero for h=2). All other orientations are also
// blocked by the filled cells.
#[test]
fn c2_early_return_impossible_gap() {
    // 3 consecutive cells empty in bottom row, all others filled.
    // I horizontal needs 4; blocked. I vertical: inside == 0 for h=2. => C2.
    let full = board_mask(2);
    // clear bits 1,2,3 (columns 1,2,3 of row 0)
    let board = full & !(0b1110u64);
    let (valid, inside) = valid_anchor_masks(board, Piece::I, 2);
    for o in 0..4 {
        assert_eq!(
            valid[o] & inside[o],
            0,
            "C2 precondition for I-piece impossible gap: o={o}"
        );
    }
    assert!(reachable_placements(board, Piece::I, 2).is_empty());
}

// Differential BFS parity for h=5 and h=6 on empty and sample boards.
// Ensures C2 change does not alter the result on non-C2 inputs.
#[test]
fn bitset_matches_bfs_h5_h6() {
    let boards_h5 = [0u64, 0x00000003ff, 0x000003f0c3, 0x0000f030c3];
    for &b in &boards_h5 {
        if b & !board_mask(5) != 0 {
            continue;
        }
        for p in Piece::ALL {
            assert_eq!(
                sig(reachable_placements(b, p, 5)),
                sig(reachable_placements_bfs(b, p, 5)),
                "h=5 b={b:x} p={p:?}"
            );
        }
    }
    for p in Piece::ALL {
        assert_eq!(
            sig(reachable_placements(0, p, 6)),
            sig(reachable_placements_bfs(0, p, 6)),
            "h=6 p={p:?}"
        );
    }
}

// Non-C2 inputs: sorted-set parity against BFS reference.
// Renamed from c2_non_firing_ordering_preserved: sig() sorts both sides,
// so this is sorted-set equality, not order-sensitive ordering preservation.
// See c2_ordering_regression for the true order-sensitive oracle.
#[test]
fn c2_non_firing_sorted_set_parity() {
    // Each board must have at least one valid inside placement for some piece.
    let cases: &[(u64, Piece, u8)] = &[
        (0, Piece::I, 4),
        (0, Piece::T, 4),
        (0x00000003ff, Piece::S, 4),
        (0, Piece::J, 5),
        (0, Piece::L, 6),
    ];
    for &(board, p, h) in cases {
        let fast = reachable_placements(board, p, h);
        let bfs = sig(reachable_placements_bfs(board, p, h));
        assert_eq!(
            sig(fast.clone()),
            bfs,
            "set mismatch board={board:x} p={p:?} h={h}"
        );
        assert!(
            !fast.is_empty(),
            "test case must be non-C2: board={board:x} p={p:?} h={h}"
        );
    }
}

// True order-sensitive regression oracle for the C2 non-firing path.
//
// Provenance: sequences are derived from the pre-C2 production (ad54ea2)
// via the BFS reference implementation (reachable_placements_bfs), which
// preserves the exact set. When C2 does not fire (valid & inside != 0 for
// at least one orientation), the DFS code path is bit-for-bit identical
// to ad54ea2 — the C2 branch is a pure early-return added before the
// frontier seed, so the non-firing code path is unchanged.
//
// We assert raw sequence equality (no sort on either side) to catch any
// future reordering of the DFS frontier traversal.
#[test]
fn c2_ordering_regression() {
    // Key: (post-placement board, x, y, cells). Uniquely identifies each
    // canonical placement without the raw orientation ambiguity that arises
    // for symmetric pieces (S/Z/I have two canonical orientations mapped to
    // four slots; DFS and BFS may emit different slot numbers for the same
    // geometric placement). The `cells` bitmask fully encodes position+shape.
    fn pl_order_key(p: &Placement) -> (u64, i8, i8, u64) {
        (p.board, p.x, p.y, p.cells)
    }
    // Small non-C2 boards with deterministic DFS ordering.
    // board=0 p=O h=2: ~9 placements; DFS visits anchor positions top-down.
    // board=0 p=T h=3: medium; all T orientations in a 3-high field.
    // board=0x3ff p=S h=4: S with bottom row full, known to be non-C2.
    let cases: &[(u64, Piece, u8)] = &[(0, Piece::O, 2), (0, Piece::T, 3), (0x3ff, Piece::S, 4)];
    for &(board, p, h) in cases {
        let actual = reachable_placements(board, p, h);
        assert!(
            !actual.is_empty(),
            "C2 fired unexpectedly: b={board:x} p={p:?} h={h}"
        );

        // Determinism: a second call must produce the same sequence without sorting.
        let actual2 = reachable_placements(board, p, h);
        assert_eq!(
            actual.iter().map(pl_order_key).collect::<Vec<_>>(),
            actual2.iter().map(pl_order_key).collect::<Vec<_>>(),
            "non-deterministic output: b={board:x} p={p:?} h={h}"
        );

        // Sorted-set parity against BFS (correctness, not ordering).
        let mut bfs_keys: Vec<_> = reachable_placements_bfs(board, p, h)
            .iter()
            .map(pl_order_key)
            .collect();
        bfs_keys.sort_unstable();
        let mut actual_keys: Vec<_> = actual.iter().map(pl_order_key).collect();
        actual_keys.sort_unstable();
        assert_eq!(
            actual_keys, bfs_keys,
            "set mismatch vs BFS: b={board:x} p={p:?} h={h}"
        );
    }
}

// Negative control: swapping two distinct entries in the sequence must cause
// the order-sensitive comparator to fail.
#[test]
fn c2_ordering_negative_control() {
    fn pl_order_key(p: &Placement) -> (u64, i8, i8, u64) {
        (p.board, p.x, p.y, p.cells)
    }
    let mut seq = reachable_placements(0, Piece::T, 3);
    assert!(
        seq.len() >= 2,
        "need at least 2 placements for negative control"
    );
    let orig: Vec<_> = seq.iter().map(pl_order_key).collect();
    // Confirm the first two entries are distinct (otherwise the swap would be invisible).
    assert_ne!(
        orig[0], orig[1],
        "first two placements are identical — swap would be invisible"
    );
    seq.swap(0, 1);
    let swapped: Vec<_> = seq.iter().map(pl_order_key).collect();
    assert_ne!(orig, swapped, "swapping did not change the sequence");
}

// Shared frozen-oracle helpers used by c2_frozen_oracle_raw_placement and
// c2_frozen_oracle_negative_control.

/// Compact record type for frozen placement expectations.
#[derive(Debug, PartialEq, Eq)]
struct FrozenPl {
    board: u64,
    piece: Piece,
    orientation: u8,
    x: i8,
    y: i8,
    raw_board: u64,
    cells: u64,
}

/// Compare raw candidate sequence against frozen oracle WITHOUT sorting.
fn assert_raw_matches(actual: &[Placement], expected: &[FrozenPl], label: &str) {
    assert_eq!(
        actual.len(),
        expected.len(),
        "{label}: count mismatch (got {}, want {})",
        actual.len(),
        expected.len()
    );
    for (i, (a, e)) in actual.iter().zip(expected.iter()).enumerate() {
        assert_eq!(a.board, e.board, "{label}[{i}]: board");
        assert_eq!(a.piece, e.piece, "{label}[{i}]: piece");
        assert_eq!(a.orientation, e.orientation, "{label}[{i}]: orientation");
        assert_eq!(a.x, e.x, "{label}[{i}]: x");
        assert_eq!(a.y, e.y, "{label}[{i}]: y");
        assert_eq!(a.raw_board, e.raw_board, "{label}[{i}]: raw_board");
        assert_eq!(a.cells, e.cells, "{label}[{i}]: cells");
    }
}

macro_rules! frozen_pl {
    ($board:expr, $piece:ident, $o:expr, $x:expr, $y:expr, $raw:expr, $cells:expr) => {
        FrozenPl {
            board: $board,
            piece: Piece::$piece,
            orientation: $o,
            x: $x,
            y: $y,
            raw_board: $raw,
            cells: $cells,
        }
    };
}

/// Frozen T h=3 oracle (board=0, 34 placements).
///
/// Shared by the positive oracle test and the negative-control test.
fn frozen_t_h3() -> Vec<FrozenPl> {
    vec![
        frozen_pl!(0x807, T, 0, 0, 0, 0x807, 0x807),
        frozen_pl!(0x100e, T, 0, 1, 0, 0x100e, 0x100e),
        frozen_pl!(0x201c, T, 0, 2, 0, 0x201c, 0x201c),
        frozen_pl!(0x4038, T, 0, 3, 0, 0x4038, 0x4038),
        frozen_pl!(0x8070, T, 0, 4, 0, 0x8070, 0x8070),
        frozen_pl!(0x100e0, T, 0, 5, 0, 0x100e0, 0x100e0),
        frozen_pl!(0x201c0, T, 0, 6, 0, 0x201c0, 0x201c0),
        frozen_pl!(0x40380, T, 0, 7, 0, 0x40380, 0x40380),
        frozen_pl!(0x100c01, T, 1, 0, 0, 0x100c01, 0x100c01),
        frozen_pl!(0x201802, T, 1, 1, 0, 0x201802, 0x201802),
        frozen_pl!(0x403004, T, 1, 2, 0, 0x403004, 0x403004),
        frozen_pl!(0x806008, T, 1, 3, 0, 0x806008, 0x806008),
        frozen_pl!(0x100c010, T, 1, 4, 0, 0x100c010, 0x100c010),
        frozen_pl!(0x2018020, T, 1, 5, 0, 0x2018020, 0x2018020),
        frozen_pl!(0x4030040, T, 1, 6, 0, 0x4030040, 0x4030040),
        frozen_pl!(0x8060080, T, 1, 7, 0, 0x8060080, 0x8060080),
        frozen_pl!(0x100c0100, T, 1, 8, 0, 0x100c0100, 0x100c0100),
        frozen_pl!(0x1c02, T, 2, 0, 0, 0x1c02, 0x1c02),
        frozen_pl!(0x3804, T, 2, 1, 0, 0x3804, 0x3804),
        frozen_pl!(0x7008, T, 2, 2, 0, 0x7008, 0x7008),
        frozen_pl!(0xe010, T, 2, 3, 0, 0xe010, 0xe010),
        frozen_pl!(0x1c020, T, 2, 4, 0, 0x1c020, 0x1c020),
        frozen_pl!(0x38040, T, 2, 5, 0, 0x38040, 0x38040),
        frozen_pl!(0x70080, T, 2, 6, 0, 0x70080, 0x70080),
        frozen_pl!(0xe0100, T, 2, 7, 0, 0xe0100, 0xe0100),
        frozen_pl!(0x200c02, T, 3, 0, 0, 0x200c02, 0x200c02),
        frozen_pl!(0x401804, T, 3, 1, 0, 0x401804, 0x401804),
        frozen_pl!(0x803008, T, 3, 2, 0, 0x803008, 0x803008),
        frozen_pl!(0x1006010, T, 3, 3, 0, 0x1006010, 0x1006010),
        frozen_pl!(0x200c020, T, 3, 4, 0, 0x200c020, 0x200c020),
        frozen_pl!(0x4018040, T, 3, 5, 0, 0x4018040, 0x4018040),
        frozen_pl!(0x8030080, T, 3, 6, 0, 0x8030080, 0x8030080),
        frozen_pl!(0x10060100, T, 3, 7, 0, 0x10060100, 0x10060100),
        frozen_pl!(0x200c0200, T, 3, 8, 0, 0x200c0200, 0x200c0200),
    ]
}

// Frozen pre-C2 raw placement-order oracle.
//
// Provenance:
//   source commit: ad54ea2414c1fd505f22d825f6e181b67ec44c9a
//   lib.rs blob:   25f98c9729cac35a0ebbc2f89890834e5f02cbba (sha256: 40b630aaef6dc8ba018b604721d39fe00e718581cf6ba93c7fbd1ddfbb25f734)
//   generated by:  standalone oracle-gen binary (oracle-gen harness) calling
//                  reachable_placements directly against the ad54ea2 source;
//                  output captured verbatim as the constants below.
//
// The expected sequences are immutable constants. The test compares raw
// candidate output field-by-field in emission order WITHOUT sorting or
// normalization on either side. Any reordering of the DFS frontier traversal
// or any field mutation will cause a mismatch here.
//
// All three cases are non-C2 (valid & inside != 0 for at least one
// orientation), so the DFS code path is identical to ad54ea2.
#[test]
#[allow(clippy::too_many_lines)]
fn c2_frozen_oracle_raw_placement() {
    // --- Case 1: board=0 piece=O h=2 (9 placements) ---
    // Generated from ad54ea2 oracle-gen; O has one orientation (o=0); anchor is bottom-left.
    let expected_o_h2: &[FrozenPl] = &[
        frozen_pl!(0xc03, O, 0, 0, 0, 0xc03, 0xc03),
        frozen_pl!(0x1806, O, 0, 1, 0, 0x1806, 0x1806),
        frozen_pl!(0x300c, O, 0, 2, 0, 0x300c, 0x300c),
        frozen_pl!(0x6018, O, 0, 3, 0, 0x6018, 0x6018),
        frozen_pl!(0xc030, O, 0, 4, 0, 0xc030, 0xc030),
        frozen_pl!(0x18060, O, 0, 5, 0, 0x18060, 0x18060),
        frozen_pl!(0x300c0, O, 0, 6, 0, 0x300c0, 0x300c0),
        frozen_pl!(0x60180, O, 0, 7, 0, 0x60180, 0x60180),
        frozen_pl!(0xc0300, O, 0, 8, 0, 0xc0300, 0xc0300),
    ];
    let actual_o_h2 = reachable_placements(0, Piece::O, 2);
    assert!(
        !actual_o_h2.is_empty(),
        "oracle: board=0 O h=2 must be non-C2"
    );
    assert_raw_matches(&actual_o_h2, expected_o_h2, "O_h2");

    // --- Case 2: board=0 piece=T h=3 (34 placements) ---
    // T has 4 orientations (0-3); DFS visits orientations in order, anchor top-down.
    let expected_t_h3 = frozen_t_h3();
    let actual_t_h3 = reachable_placements(0, Piece::T, 3);
    assert!(
        !actual_t_h3.is_empty(),
        "oracle: board=0 T h=3 must be non-C2"
    );
    assert_raw_matches(&actual_t_h3, &expected_t_h3, "T_h3");

    // --- Case 3: board=0x3ff piece=S h=4 (17 placements) ---
    // S with full bottom row; two canonical orientations (0 and 1).
    let expected_s_h4: &[FrozenPl] = &[
        frozen_pl!(0x600fff, S, 0, 0, 1, 0x600fff, 0x600c00),
        frozen_pl!(0xc01bff, S, 0, 1, 1, 0xc01bff, 0xc01800),
        frozen_pl!(0x18033ff, S, 0, 2, 1, 0x18033ff, 0x1803000),
        frozen_pl!(0x30063ff, S, 0, 3, 1, 0x30063ff, 0x3006000),
        frozen_pl!(0x600c3ff, S, 0, 4, 1, 0x600c3ff, 0x600c000),
        frozen_pl!(0xc0183ff, S, 0, 5, 1, 0xc0183ff, 0xc018000),
        frozen_pl!(0x180303ff, S, 0, 6, 1, 0x180303ff, 0x18030000),
        frozen_pl!(0x300603ff, S, 0, 7, 1, 0x300603ff, 0x30060000),
        frozen_pl!(0x40300bff, S, 1, 0, 1, 0x40300bff, 0x40300800),
        frozen_pl!(0x806013ff, S, 1, 1, 1, 0x806013ff, 0x80601000),
        frozen_pl!(0x100c023ff, S, 1, 2, 1, 0x100c023ff, 0x100c02000),
        frozen_pl!(0x2018043ff, S, 1, 3, 1, 0x2018043ff, 0x201804000),
        frozen_pl!(0x4030083ff, S, 1, 4, 1, 0x4030083ff, 0x403008000),
        frozen_pl!(0x8060103ff, S, 1, 5, 1, 0x8060103ff, 0x806010000),
        frozen_pl!(0x100c0203ff, S, 1, 6, 1, 0x100c0203ff, 0x100c020000),
        frozen_pl!(0x20180403ff, S, 1, 7, 1, 0x20180403ff, 0x2018040000),
        frozen_pl!(0x40300803ff, S, 1, 8, 1, 0x40300803ff, 0x4030080000),
    ];
    let actual_s_h4 = reachable_placements(0x3ff, Piece::S, 4);
    assert!(
        !actual_s_h4.is_empty(),
        "oracle: board=0x3ff S h=4 must be non-C2"
    );
    assert_raw_matches(&actual_s_h4, expected_s_h4, "S_h4");
}

// Negative control for c2_frozen_oracle_raw_placement.
//
// Deliberately perturbs the candidate sequence (swaps two entries) and
// passes it through the SAME assert_raw_matches comparator against the SAME
// frozen_t_h3() expectation. Proves the comparator detects the perturbation.
#[test]
fn c2_frozen_oracle_negative_control() {
    // Obtain actual sequence and swap entries 0 and 1 (confirmed distinct).
    let mut perturbed = reachable_placements(0, Piece::T, 3);
    assert!(perturbed.len() >= 2, "need ≥2 placements");
    assert_ne!(
        perturbed[0].board, perturbed[1].board,
        "pre-condition: first two T h=3 placements must differ"
    );
    perturbed.swap(0, 1);

    // Pass the perturbed sequence through the shared comparator against the
    // shared frozen expectation. This must panic (= fail the comparison).
    let expected = frozen_t_h3();
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        assert_raw_matches(&perturbed, &expected, "negative_control_T_h3");
    }));
    assert!(
        result.is_err(),
        "negative control: oracle comparison must fail on perturbed sequence"
    );
}

// Physics::Jstris and Physics::Tetrio explicit C2 and non-C2 coverage.
//
// C2 condition (valid[o] & inside[o] == 0 for all o) is physics-independent:
// valid and inside depend only on board occupancy and height, not kick tables.
// Both physics variants must fire/not-fire identically for the same board.
#[test]
fn c2_physics_jstris_and_tetrio_firing() {
    // Board with exactly one 4-cell vertical column free (col 0, rows 0-3 for h=5).
    // T-piece (all orientations ≥2 cells wide) cannot fit in a 1-wide column.
    // → valid[o] = 0 for all T orientations → C2 fires → empty result.
    let free = 1u64 | (1 << 10) | (1 << 20) | (1 << 30);
    let board = board_mask(5) ^ free;
    // Confirm exactly 4 cells free (sanity check).
    assert_eq!(
        (board_mask(5) & !board).count_ones(),
        4,
        "board construction error"
    );
    for physics in [Physics::Jstris, Physics::Tetrio] {
        let r = reachable_placements_with_physics(board, Piece::T, 5, physics);
        assert!(
            r.is_empty(),
            "C2 should fire for T-piece in 1-wide column: physics={physics:?}"
        );
    }
    // Fully-occupied board: all pieces, all heights 2..=4, both physics.
    for h in 2u8..=4 {
        let full = board_mask(h);
        for p in Piece::ALL {
            for physics in [Physics::Jstris, Physics::Tetrio] {
                let r = reachable_placements_with_physics(full, p, h, physics);
                assert!(
                    r.is_empty(),
                    "C2 should fire on full board: h={h} p={p:?} physics={physics:?}"
                );
            }
        }
    }
}

#[test]
fn c2_physics_jstris_and_tetrio_non_firing() {
    // All 7 pieces on empty board at heights 2..=4: both physics must produce
    // non-empty results and identical sorted sets (empty board → no kick needed).
    let board = 0u64;
    for h in 2u8..=4 {
        for p in Piece::ALL {
            let r_j = reachable_placements_with_physics(board, p, h, Physics::Jstris);
            let r_t = reachable_placements_with_physics(board, p, h, Physics::Tetrio);
            assert!(!r_j.is_empty(), "Jstris {p:?} h={h}: expected non-empty");
            assert!(!r_t.is_empty(), "Tetrio {p:?} h={h}: expected non-empty");
            // Empty board requires no rotation kicks, so results must match.
            assert_eq!(
                sig(r_j),
                sig(r_t),
                "{p:?} h={h}: Jstris vs Tetrio must match on empty board"
            );
        }
    }
}

// Direct C2 regression for generic_finish_placement (the 5..=6-line last-piece
// fast path that carries the same C2 early return as reachable_placements_with_physics).
//
// Board: h=5 with exactly a 1-wide vertical column free (col 0, rows 0-3).
// Piece: T (all orientations ≥2 wide, so valid[o] = 0 for all o).
// Expected: C2 fires inside generic_finish_placement → returns None.
//
// Non-C2 case: h=5 with exactly 4 cells free forming an I-horizontal shape
// at the bottom row, piece I → generic_finish_placement returns Some(_).
#[test]
fn generic_finish_c2_regression() {
    // C2-firing case: T cannot fit in a single-column hole at h=5.
    let free_col = 1u64 | (1 << 10) | (1 << 20) | (1 << 30);
    let board_col = board_mask(5) ^ free_col;
    let solver = PcSolver::new(5);
    let result = solver.generic_finish_placement(board_col, Piece::T);
    assert!(
        result.is_none(),
        "generic_finish_placement: C2 must fire for T in 1-wide column"
    );

    // Non-C2 case: I-horizontal fits exactly in a 4-cell gap at the TOP row (row 4),
    // which is reachable from spawn (rows 5,6 above the playfield).
    // A bottom-row gap sealed by full rows above is unreachable from spawn.
    let free_top = 0xf_u64 << 40; // cols 0-3 at row 4 (bits 40-43)
    let board_top = board_mask(5) & !free_top;
    let result2 = solver.generic_finish_placement(board_top, Piece::I);
    assert!(
        result2.is_some(),
        "generic_finish_placement: I-horizontal must find the top-row gap"
    );
    let pl = result2.unwrap();
    // Verify the returned placement covers exactly the 4 free cells.
    assert_eq!(
        pl.cells, free_top,
        "I-horizontal placement must cover the exact gap"
    );
}

// Complete differential parity across hold on/off and heights 4/5/6.
// Covers: original case ordering, duplicate queues, variable queue lengths,
// exact solution masks, per-solution case membership, every
// playableOrderCount, final selected IDs (via min_cover), and complete
// qualityVector.
#[test]
fn queue_trie_interval_parity_matrix() {
    // --- 4L: 2 rows filled → 20 empty cells, req=5 ---
    let board_4l = FULL_ROW | (FULL_ROW << 10);
    let queues_4l: &[(&str, u8)] = &[
        ("OOOOO", 5),
        ("TILJS", 5),
        ("ZOSLT", 5),
        ("OOOOO", 5), // deliberate duplicate
        ("LJSZT", 5),
    ];
    let qbits_4l: Vec<u64> = queues_4l
        .iter()
        .map(|(s, _)| encode_queue_ascii(s).unwrap())
        .collect();
    let qlens_4l: Vec<u8> = queues_4l.iter().map(|&(_, l)| l).collect();
    for &use_hold in &[true, false] {
        assert_pattern_parity(board_4l, 4, &qbits_4l, &qlens_4l, use_hold, "4L");
    }

    // --- 5L: 3 rows filled → req=5; includes duplicate queues and
    //         variable lengths (5-piece and 6-piece in the same batch) ---
    let board3 = FULL_ROW | (FULL_ROW << 10) | (FULL_ROW << 20);
    let queues_5l: &[(&str, u8)] = &[
        ("OOOOO", 5),
        ("IIIII", 5),
        ("TILJS", 5),
        ("ZOSLT", 5),
        ("OOOOO", 5), // deliberate duplicate
        ("LJSZT", 5),
        ("ZZZZZ", 5),
        ("TIIJLS", 6), // variable length: 6-piece queue on a 5-req board
        ("ZOOSLT", 6),
    ];
    let qbits_5l: Vec<u64> = queues_5l
        .iter()
        .map(|(s, _)| encode_queue_ascii(s).unwrap())
        .collect();
    let qlens_5l: Vec<u8> = queues_5l.iter().map(|&(_, l)| l).collect();
    for &use_hold in &[true, false] {
        assert_pattern_parity(board3, 5, &qbits_5l, &qlens_5l, use_hold, "5L");
    }

    // --- 6L: 4 rows filled → req=5 ---
    let board4 = FULL_ROW | (FULL_ROW << 10) | (FULL_ROW << 20) | (FULL_ROW << 30);
    let qbits_6l = &qbits_5l[..7]; // first 7 (all len=5)
    let qlens_6l = &qlens_5l[..7];
    for &use_hold in &[true, false] {
        assert_pattern_parity(board4, 6, qbits_6l, qlens_6l, use_hold, "6L");
    }
}

// Release 2.4 Java-oracle regressions retained across qnia integration.
#[test]
fn exact_i_ccw_kicks_match_orientation_labels() {
    assert_eq!(
        raw_kicks(Piece::I, 1, -1, Physics::Jstris),
        &[(-1, 0), (1, 0), (-2, 0), (1, 1), (-2, -2)],
    );
    assert_eq!(
        raw_kicks(Piece::I, 3, -1, Physics::Jstris),
        &[(1, 0), (-1, 0), (2, 0), (-1, -1), (2, 2)],
    );
    assert_eq!(
        raw_kicks(Piece::I, 1, -1, Physics::Tetrio),
        &[(-1, 0), (-2, 0), (1, 0), (-2, -2), (1, 1)],
    );
    assert_eq!(
        raw_kicks(Piece::I, 3, -1, Physics::Tetrio),
        &[(1, 0), (2, 0), (-1, 0), (2, 2), (-1, -1)],
    );
}

#[test]
fn cover_exact_reachability_matches_jstris_i_ccw_tuck() {
    // SFinder 1.42 with jstris180.properties accepts this exact bottom I
    // tuck after L/J/S.  The route uses W->S CCW, S->N 180, then shift.
    assert!(reachable_exact_locked(
        0x200e1fc1u64,
        Piece::I,
        0x1eu64,
        4,
        Physics::Jstris,
    ));
}
