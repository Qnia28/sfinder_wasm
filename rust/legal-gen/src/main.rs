use pc_core::{
    FastBuildHasher, Piece, full_board, geometric_predecessor_pairs, has_imbalanced_split,
    has_isolated_cell, reachable_placements,
};
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread;
use std::time::Instant;

type Set = HashSet<u64, FastBuildHasher>;
type LegalSection = (u8, Vec<u8>, Vec<u64>);
const THREADS: usize = 5;
const ORACLE_STAGE9_PLACEMENTS: u8 = 1;
const ORACLE_STAGE8_PAIR_MASKS: u8 = 2;

fn exact_preds(out: u64, h: u8) -> Vec<u64> {
    let mut s = Set::default();
    for (b, p) in geometric_predecessor_pairs(out, h) {
        if h == 4 && (has_isolated_cell(b) || has_imbalanced_split(b)) {
            continue;
        }
        if reachable_placements(b, p, h)
            .into_iter()
            .any(|x| x.board == out)
        {
            s.insert(b);
        }
    }
    s.into_iter().collect()
}

fn previous(cur: &[u64], h: u8) -> Vec<u64> {
    let cur = Arc::new(cur.to_vec());
    let chunk = cur.len().div_ceil(THREADS);
    let mut hs = Vec::new();
    for ti in 0..THREADS {
        let c = cur.clone();
        let a = ti * chunk;
        let z = ((ti + 1) * chunk).min(c.len());
        if a >= z {
            continue;
        }
        hs.push(thread::spawn(move || {
            let mut s = Set::default();
            for &out in &c[a..z] {
                s.extend(exact_preds(out, h))
            }
            s
        }))
    }
    let mut all = Set::default();
    for x in hs {
        all.extend(x.join().unwrap())
    }
    let mut v: Vec<_> = all.into_iter().collect();
    v.sort_unstable();
    v
}

fn delta(path: &Path, v: &[u64]) {
    let mut f = File::create(path).unwrap();
    let mut prev = 0;
    for &x in v {
        let mut d = x - prev;
        prev = x;
        while d >= 128 {
            f.write_all(&[((d as u8) & 127) | 128]).unwrap();
            d >>= 7
        }
        f.write_all(&[d as u8]).unwrap()
    }
}

fn raw(path: &Path, v: &[u64]) {
    let mut f = File::create(path).unwrap();
    for &x in v {
        f.write_all(&x.to_le_bytes()).unwrap()
    }
}

fn decode_delta(payload: &[u8]) -> Result<Vec<u64>, String> {
    let mut out = Vec::with_capacity(payload.iter().filter(|&&b| b & 0x80 == 0).count());
    let mut pos = 0usize;
    let mut prev = 0u64;
    while pos < payload.len() {
        let mut shift = 0u32;
        let mut d = 0u64;
        loop {
            if pos >= payload.len() || shift >= 64 {
                return Err("invalid delta stream".into());
            }
            let b = payload[pos];
            pos += 1;
            d |= ((b & 0x7f) as u64) << shift;
            if b & 0x80 == 0 {
                break;
            }
            shift += 7;
        }
        prev = prev.checked_add(d).ok_or("delta overflow")?;
        if prev >> 40 != 0 || out.last().is_some_and(|&x| x >= prev) {
            return Err("invalid board order".into());
        }
        out.push(prev);
    }
    Ok(out)
}

fn read_pack_legal(path: &Path) -> Result<Vec<LegalSection>, String> {
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    if bytes.len() < 5 || (&bytes[..4] != b"LGB1" && &bytes[..4] != b"LGB2") {
        return Err("not an LGB1/LGB2 pack".into());
    }
    let mut pos = 5usize;
    let count = bytes[4] as usize;
    let mut out = Vec::with_capacity(count);
    for _ in 0..count {
        if pos + 5 > bytes.len() {
            return Err("truncated legal section".into());
        }
        let stage = bytes[pos];
        pos += 1;
        let len = u32::from_le_bytes(bytes[pos..pos + 4].try_into().unwrap()) as usize;
        pos += 4;
        if pos + len > bytes.len() {
            return Err("truncated legal payload".into());
        }
        let payload = bytes[pos..pos + len].to_vec();
        pos += len;
        let boards = decode_delta(&payload)?;
        out.push((stage, payload, boards));
    }
    Ok(out)
}

#[inline]
fn encode_lock(orientation: u8, x: i8, y: i8) -> u16 {
    (orientation as u16 & 3) | ((x as u16 & 0xf) << 2) | ((y as u16 & 7) << 6)
}

fn build_stage9_oracle(stage9: &[u64], h: u8) -> Vec<u16> {
    let mut out = vec![u16::MAX; stage9.len() * 7];
    let full = full_board(h);
    for (bi, &board) in stage9.iter().enumerate() {
        for piece in Piece::ALL {
            let mut finishers = reachable_placements(board, piece, h)
                .into_iter()
                .filter(|pl| pl.board == full);
            if let Some(pl) = finishers.next() {
                // A stage-9 board has exactly four empty cells, so one piece can
                // have at most one distinct finishing geometry.  Keep this
                // assertion in the generator so the compact LGB2 format cannot
                // silently lose a future ruleset change.
                assert!(finishers.next().is_none());
                out[bi * 7 + piece as usize] = encode_lock(pl.orientation, pl.x, pl.y);
            }
        }
    }
    out
}

fn build_stage8_pairs(stage8: &[u64], stage9: &[u64], finish: &[u16], h: u8) -> Vec<u8> {
    let mut out = vec![0u8; stage8.len() * 7];
    for (bi, &board) in stage8.iter().enumerate() {
        if bi % 2048 == 0 {
            eprintln!("oracle stage8 {bi}/{}", stage8.len());
        }
        for first in Piece::ALL {
            let mut mask = 0u8;
            for pl in reachable_placements(board, first, h) {
                let Ok(si) = stage9.binary_search(&pl.board) else {
                    continue;
                };
                for second in Piece::ALL {
                    if finish[si * 7 + second as usize] != u16::MAX {
                        mask |= 1 << second as u8;
                    }
                }
                if mask == 0x7f {
                    break;
                }
            }
            out[bi * 7 + first as usize] = mask;
        }
    }
    out
}

fn u16_payload(values: &[u16]) -> Vec<u8> {
    let mut out = Vec::with_capacity(values.len() * 2);
    for &value in values {
        out.extend_from_slice(&value.to_le_bytes());
    }
    out
}

fn write_lgb2(path: &Path, legal: &[(u8, Vec<u8>)], stage8_pairs: &[u8], stage9_finish: &[u16]) {
    let mut f = File::create(path).unwrap();
    f.write_all(b"LGB2").unwrap();
    f.write_all(&[legal.len() as u8]).unwrap();
    for (stage, payload) in legal {
        f.write_all(&[*stage]).unwrap();
        f.write_all(&(payload.len() as u32).to_le_bytes()).unwrap();
        f.write_all(payload).unwrap();
    }
    f.write_all(&[2]).unwrap();
    let finish_payload = u16_payload(stage9_finish);
    f.write_all(&[ORACLE_STAGE9_PLACEMENTS, 9]).unwrap();
    f.write_all(&(finish_payload.len() as u32).to_le_bytes())
        .unwrap();
    f.write_all(&finish_payload).unwrap();
    f.write_all(&[ORACLE_STAGE8_PAIR_MASKS, 8]).unwrap();
    f.write_all(&(stage8_pairs.len() as u32).to_le_bytes())
        .unwrap();
    f.write_all(stage8_pairs).unwrap();
}

fn write_pack_from_root(path: &Path, root: &Path, min_stage: usize, max_stage: usize, h: u8) {
    let mut legal = Vec::new();
    let mut stage8 = Vec::new();
    let mut stage9 = Vec::new();
    for stage in min_stage..=max_stage {
        let payload = fs::read(root.join(format!("legal_{stage}.leb"))).unwrap();
        let boards = decode_delta(&payload).unwrap();
        if stage == 8 {
            stage8 = boards.clone();
        } else if stage == 9 {
            stage9 = boards.clone();
        }
        legal.push((stage as u8, payload));
    }
    if h == 4 && !stage8.is_empty() && !stage9.is_empty() {
        let finish = build_stage9_oracle(&stage9, h);
        let pairs = build_stage8_pairs(&stage8, &stage9, &finish, h);
        write_lgb2(path, &legal, &pairs, &finish);
    } else {
        // LGB2 still uses two empty oracle sections only for 4-line packs; other
        // heights currently have no late-table contract.
        write_lgb2(path, &legal, &[], &[]);
    }
}

fn upgrade_pack(input: &Path, output: &Path) -> Result<(), String> {
    let sections = read_pack_legal(input)?;
    let stage8 = sections
        .iter()
        .find(|(stage, _, _)| *stage == 8)
        .map(|x| x.2.as_slice())
        .ok_or("missing stage 8")?;
    let stage9 = sections
        .iter()
        .find(|(stage, _, _)| *stage == 9)
        .map(|x| x.2.as_slice())
        .ok_or("missing stage 9")?;
    let finish = build_stage9_oracle(stage9, 4);
    let pairs = build_stage8_pairs(stage8, stage9, &finish, 4);
    let legal: Vec<_> = sections
        .into_iter()
        .map(|(stage, payload, _)| (stage, payload))
        .collect();
    write_lgb2(output, &legal, &pairs, &finish);
    Ok(())
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    if a.get(1).is_some_and(|x| x == "upgrade") {
        let input = PathBuf::from(a.get(2).expect("usage: legal-gen upgrade INPUT OUTPUT"));
        let output = PathBuf::from(a.get(3).expect("usage: legal-gen upgrade INPUT OUTPUT"));
        let t = Instant::now();
        upgrade_pack(&input, &output).unwrap();
        eprintln!("wrote {} in {:?}", output.display(), t.elapsed());
        return;
    }

    let h: u8 = a.get(1).and_then(|x| x.parse().ok()).unwrap_or(4);
    let min_stage: usize = a.get(2).and_then(|x| x.parse().ok()).unwrap_or(7);
    let root = PathBuf::from(
        a.get(3)
            .cloned()
            .unwrap_or_else(|| format!("generated/legal_late_h{h}")),
    );
    fs::create_dir_all(&root).unwrap();
    let max = h as usize * 10 / 4;
    let mut cur = vec![full_board(h)];
    raw(&root.join(format!("legal_{max}.raw")), &cur);
    delta(&root.join(format!("legal_{max}.leb")), &cur);
    for stage in (min_stage..max).rev() {
        let t = Instant::now();
        cur = previous(&cur, h);
        eprintln!(
            "reverse exact h={h} stage={stage} boards={} {:?}",
            cur.len(),
            t.elapsed()
        );
        raw(&root.join(format!("legal_{stage}.raw")), &cur);
        delta(&root.join(format!("legal_{stage}.leb")), &cur);
    }
    let pack = root.join(format!("legal_boards_{h}.lgb"));
    write_pack_from_root(&pack, &root, min_stage, max, h);
    eprintln!("wrote {}", pack.display());
}
