use super::*;

// Reverse geometric predecessor candidates used by the offline legal-board tool.
pub fn geometric_predecessor_pairs(out: u64, height: u8) -> Vec<(u64, Piece)> {
    let cp = cleared_floor(out, height);
    let unresolved: Vec<u64> = (cp..height).map(|y| row(out, y)).collect();
    let mut preds: FastSet<(u64, u8)> = FastSet::default();
    for c in 0..=cp {
        let d = (cp - c) as usize;
        let slots = (height - c) as usize;
        if d > slots {
            continue;
        }
        for fullmask in 0..(1usize << slots) {
            if fullmask.count_ones() as usize != d {
                continue;
            }
            let mut raw = 0u64;
            for y in 0..c {
                raw |= FULL_ROW << (y as u32 * 10);
            }
            let mut ui = 0usize;
            for i in 0..slots {
                let y = c + i as u8;
                if (fullmask >> i) & 1 == 1 {
                    raw |= FULL_ROW << (y as u32 * 10);
                } else {
                    raw |= unresolved[ui] << (y as u32 * 10);
                    ui += 1;
                }
            }
            if normalize_after_placement(raw, height) != out {
                continue;
            }
            for piece in Piece::ALL {
                for o in 0..4u8 {
                    for y in c as i8..height as i8 {
                        if y + MAX_Y[piece as usize][o as usize] >= height as i8 {
                            continue;
                        }
                        for x in 0..=MAX_X[piece as usize][o as usize] {
                            let bits = place_bits(piece, o, x, y);
                            if bits & raw != bits {
                                continue;
                            }
                            if c > 0 && bits & ((1u64 << (c as u32 * 10)) - 1) != 0 {
                                continue;
                            }
                            let b = raw & !bits;
                            if normalize_after_placement(b, height) != b {
                                continue;
                            }
                            if b.count_ones() + 4 != out.count_ones() {
                                continue;
                            }
                            preds.insert((b, piece as u8));
                        }
                    }
                }
            }
        }
    }
    preds
        .into_iter()
        .filter_map(|(b, p)| Some((b, Piece::from_u8(p)?)))
        .collect()
}
pub fn geometric_predecessors(out: u64, height: u8) -> Vec<u64> {
    let mut s: FastSet<u64> = FastSet::default();
    for (b, _) in geometric_predecessor_pairs(out, height) {
        s.insert(b);
    }
    s.into_iter().collect()
}
