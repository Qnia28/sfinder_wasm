use pc_core::{PcSolver, Piece};
use std::fs;
use std::path::PathBuf;

fn pack_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../wasm/legal_boards_4.lgb")
}

fn decode_delta(payload: &[u8]) -> Vec<u64> {
    let mut out = Vec::new();
    let mut pos = 0usize;
    let mut prev = 0u64;
    while pos < payload.len() {
        let mut shift = 0;
        let mut d = 0u64;
        loop {
            let b = payload[pos];
            pos += 1;
            d |= ((b & 0x7f) as u64) << shift;
            if b & 0x80 == 0 {
                break;
            }
            shift += 7;
        }
        prev += d;
        out.push(prev);
    }
    out
}

fn legal_stage(pack: &[u8], wanted: u8) -> Vec<u64> {
    assert!(pack.starts_with(b"LGB2"));
    let mut pos = 5usize;
    for _ in 0..pack[4] {
        let stage = pack[pos];
        pos += 1;
        let len = u32::from_le_bytes(pack[pos..pos + 4].try_into().unwrap()) as usize;
        pos += 4;
        let end = pos + len;
        if stage == wanted {
            return decode_delta(&pack[pos..end]);
        }
        pos = end;
    }
    Vec::new()
}

fn without_oracle(pack: &[u8]) -> Vec<u8> {
    assert!(pack.starts_with(b"LGB2"));
    let mut pos = 5usize;
    for _ in 0..pack[4] {
        pos += 1;
        let len = u32::from_le_bytes(pack[pos..pos + 4].try_into().unwrap()) as usize;
        pos += 4 + len;
    }
    let mut out = pack[..pos].to_vec();
    out[..4].copy_from_slice(b"LGB1");
    out
}

fn signatures(mut values: Vec<pc_core::Solution>) -> Vec<([u64; 7], u32)> {
    let mut out: Vec<_> = values.drain(..).map(|x| (x.masks, x.order_count)).collect();
    out.sort_unstable();
    out
}

#[test]
fn lgb2_counts_oracles_and_hybrid_memory() {
    let pack = fs::read(pack_path()).unwrap();
    let mut solver = PcSolver::new(4);
    assert!(solver.load_legal_pack(&pack));
    assert_eq!(solver.legal_pack_version(), 2);
    assert_eq!(
        [7, 8, 9, 10].map(|stage| solver.legal_count(stage)),
        [2_015_406, 24_748, 100, 1]
    );
    assert_eq!(solver.stage8_oracle_entries(), 24_748 * 7);
    assert_eq!(solver.stage9_oracle_entries(), 100 * 7);
    // The old all-5-byte representation used >10 MiB for these stages.  The
    // stage-7 prefix/suffix table plus both late oracles stays below 7 MiB.
    assert!(
        solver.legal_memory_bytes() < 7_000_000,
        "{}",
        solver.legal_memory_bytes()
    );
}

#[test]
fn stage9_finisher_oracle_matches_legacy_for_every_board_and_piece() {
    let pack = fs::read(pack_path()).unwrap();
    let legacy = without_oracle(&pack);
    let boards = legal_stage(&pack, 9);
    assert_eq!(boards.len(), 100);
    let mut fast = PcSolver::new(4);
    let mut old = PcSolver::new(4);
    assert!(fast.load_legal_pack(&pack));
    assert!(old.load_legal_pack(&legacy));
    for board in boards {
        for piece in Piece::ALL {
            let queue = [piece];
            assert_eq!(
                fast.can_pc(board, &queue, false),
                old.can_pc(board, &queue, false),
                "can_pc board={board:x} piece={piece:?}"
            );
            assert_eq!(
                signatures(fast.enumerate_pc(board, &queue, false)),
                signatures(old.enumerate_pc(board, &queue, false)),
                "enumerate board={board:x} piece={piece:?}"
            );
        }
    }
}

#[test]
fn stage8_pair_oracle_matches_legacy_with_and_without_hold() {
    let pack = fs::read(pack_path()).unwrap();
    let legacy = without_oracle(&pack);
    let boards = legal_stage(&pack, 8);
    assert_eq!(boards.len(), 24_748);
    let mut fast = PcSolver::new(4);
    let mut old = PcSolver::new(4);
    assert!(fast.load_legal_pack(&pack));
    assert!(old.load_legal_pack(&legacy));
    for &board in boards.iter().step_by(257) {
        for first in Piece::ALL {
            for second in Piece::ALL {
                let queue = [first, second];
                for hold in [false, true] {
                    assert_eq!(
                        fast.can_pc(board, &queue, hold),
                        old.can_pc(board, &queue, hold),
                        "board={board:x} queue={first:?}{second:?} hold={hold}"
                    );
                }
            }
        }
    }
}

#[test]
fn stage8_enumeration_geometry_matches_legacy_sample() {
    let pack = fs::read(pack_path()).unwrap();
    let legacy = without_oracle(&pack);
    let boards = legal_stage(&pack, 8);
    let mut fast = PcSolver::new(4);
    let mut old = PcSolver::new(4);
    assert!(fast.load_legal_pack(&pack));
    assert!(old.load_legal_pack(&legacy));
    let pairs = [
        [Piece::I, Piece::T],
        [Piece::J, Piece::L],
        [Piece::O, Piece::S],
        [Piece::T, Piece::Z],
    ];
    for &board in boards.iter().step_by(1237) {
        for queue in pairs {
            assert_eq!(
                signatures(fast.enumerate_pc(board, &queue, true)),
                signatures(old.enumerate_pc(board, &queue, true)),
                "board={board:x} queue={queue:?}"
            );
        }
    }
}
