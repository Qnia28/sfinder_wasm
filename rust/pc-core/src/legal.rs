use std::mem::size_of;

use crate::board::{full_board, normalize_after_placement};
use crate::movement::place_bits;
use crate::{Piece, Placement};

#[derive(Default)]
pub(crate) struct PackedBoards {
    pub(crate) data: Vec<u8>,
    pub(crate) len: usize,
}
impl PackedBoards {
    #[inline]
    pub(crate) fn push(&mut self, board: u64) {
        self.data.extend_from_slice(&board.to_le_bytes()[..5]);
        self.len += 1;
    }
    #[inline]
    pub(crate) fn finish(&mut self) {
        self.data.extend_from_slice(&[0; 3]);
    }
    #[inline]
    fn len(&self) -> usize {
        self.len
    }
    #[inline]
    pub(crate) fn get(&self, index: usize) -> u64 {
        debug_assert!(index < self.len);
        let p = index * 5;
        // Three padding bytes appended by finish() make the final unaligned
        // 64-bit load safe; only the low 40 board bits are retained.
        let value = unsafe { (self.data.as_ptr().add(p) as *const u64).read_unaligned() };
        value & ((1u64 << 40) - 1)
    }
    #[inline]
    pub(crate) fn find(&self, board: u64) -> Option<usize> {
        let mut lo = 0usize;
        let mut hi = self.len();
        while lo < hi {
            let mid = (lo + hi) >> 1;
            let value = self.get(mid);
            if value < board {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        (lo < self.len() && self.get(lo) == board).then_some(lo)
    }
    #[inline]
    fn memory_bytes(&self) -> usize {
        self.data.capacity()
    }
}

fn delta_value_count(payload: &[u8]) -> usize {
    payload.iter().filter(|&&b| b & 0x80 == 0).count()
}

fn decode_delta_each(payload: &[u8], mut visit: impl FnMut(u64) -> Option<()>) -> Option<usize> {
    let mut pos = 0usize;
    let mut prev = 0u64;
    let mut count = 0usize;
    while pos < payload.len() {
        let mut shift = 0u32;
        let mut delta = 0u64;
        loop {
            if pos >= payload.len() || shift >= 64 {
                return None;
            }
            let byte = payload[pos];
            pos += 1;
            delta |= ((byte & 0x7f) as u64) << shift;
            if byte & 0x80 == 0 {
                break;
            }
            shift += 7;
        }
        let value = prev.checked_add(delta)?;
        if value >> 40 != 0 || (count != 0 && value <= prev) {
            return None;
        }
        visit(value)?;
        prev = value;
        count += 1;
    }
    Some(count)
}

// Stage 7 contains ~2M boards.  Keeping every 40-bit board as five packed
// bytes costs about 10 MiB and a global binary search needs ~21 comparisons.
// Split each board into a 16-bit prefix and 24-bit suffix instead.  The prefix
// table is 65,537 u32 offsets (~256 KiB) and suffixes use three bytes each
// (~6.05 MiB); lookup binary-searches only the matching prefix bucket.
#[derive(Default)]
struct Prefix16Boards24 {
    offsets: Vec<u32>,
    suffixes: Vec<u8>,
    len: usize,
}
impl Prefix16Boards24 {
    fn from_delta(payload: &[u8]) -> Option<Self> {
        let value_count = delta_value_count(payload);
        if value_count == 0 {
            return Some(Self::default());
        }
        let mut counts = vec![0u32; 1 << 16];
        let mut suffixes = Vec::with_capacity(value_count * 3 + 1);
        let decoded = decode_delta_each(payload, |board| {
            let prefix = (board >> 24) as usize;
            counts[prefix] = counts[prefix].checked_add(1)?;
            let bytes = (board as u32).to_le_bytes();
            suffixes.extend_from_slice(&bytes[..3]);
            Some(())
        })?;
        if decoded != value_count {
            return None;
        }
        suffixes.push(0);
        let mut offsets = Vec::with_capacity((1 << 16) + 1);
        offsets.push(0);
        let mut sum = 0u32;
        for count in counts {
            sum = sum.checked_add(count)?;
            offsets.push(sum);
        }
        Some(Self {
            offsets,
            suffixes,
            len: decoded,
        })
    }
    #[inline]
    fn get_suffix(&self, index: usize) -> u32 {
        let p = index * 3;
        let value = unsafe { (self.suffixes.as_ptr().add(p) as *const u32).read_unaligned() };
        value & 0x00ff_ffff
    }
    fn find(&self, board: u64) -> Option<usize> {
        if board >> 40 != 0 || self.offsets.is_empty() {
            return None;
        }
        let prefix = (board >> 24) as usize;
        let suffix = (board & 0x00ff_ffff) as u32;
        let start = self.offsets[prefix] as usize;
        let mut lo = start;
        let mut hi = self.offsets[prefix + 1] as usize;
        while lo < hi {
            let mid = (lo + hi) >> 1;
            if self.get_suffix(mid) < suffix {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        (lo < self.offsets[prefix + 1] as usize && self.get_suffix(lo) == suffix).then_some(lo)
    }
    #[inline]
    fn len(&self) -> usize {
        self.len
    }
    #[inline]
    fn memory_bytes(&self) -> usize {
        self.offsets.capacity() * size_of::<u32>() + self.suffixes.capacity()
    }
}

#[derive(Default)]
enum LegalStage {
    #[default]
    Empty,
    Packed(PackedBoards),
    Prefix16_24(Prefix16Boards24),
}
impl LegalStage {
    fn from_delta(stage: usize, payload: &[u8]) -> Option<Self> {
        let value_count = delta_value_count(payload);
        if value_count == 0 {
            return Some(Self::Empty);
        }
        if stage == 7 {
            return Some(Self::Prefix16_24(Prefix16Boards24::from_delta(payload)?));
        }
        let mut packed = PackedBoards {
            data: Vec::with_capacity(value_count * 5 + 3),
            len: 0,
        };
        let decoded = decode_delta_each(payload, |board| {
            packed.push(board);
            Some(())
        })?;
        if decoded != value_count {
            return None;
        }
        packed.finish();
        Some(Self::Packed(packed))
    }
    #[inline]
    fn len(&self) -> usize {
        match self {
            Self::Empty => 0,
            Self::Packed(x) => x.len(),
            Self::Prefix16_24(x) => x.len(),
        }
    }
    #[inline]
    fn find(&self, board: u64) -> Option<usize> {
        match self {
            Self::Empty => None,
            Self::Packed(x) => x.find(board),
            Self::Prefix16_24(x) => x.find(board),
        }
    }
    #[inline]
    fn contains(&self, board: u64) -> bool {
        self.find(board).is_some()
    }
    #[inline]
    fn memory_bytes(&self) -> usize {
        match self {
            Self::Empty => 0,
            Self::Packed(x) => x.memory_bytes(),
            Self::Prefix16_24(x) => x.memory_bytes(),
        }
    }
}

const ORACLE_STAGE9_PLACEMENTS: u8 = 1;
const ORACLE_STAGE8_PAIR_MASKS: u8 = 2;

pub struct LegalTables {
    stages: [LegalStage; 11],
    // Indexed by stage-9 board index * 7 + piece.  u16::MAX means that piece
    // cannot finish; otherwise bits encode orientation(2), x(4), y(3).
    stage9_finish: Vec<u16>,
    // Indexed by stage-8 board index * 7 + first piece.  Each byte is a
    // 7-piece mask describing which second piece can complete the PC.
    stage8_pair_masks: Vec<u8>,
    version: u8,
}
impl Default for LegalTables {
    fn default() -> Self {
        Self {
            stages: std::array::from_fn(|_| LegalStage::default()),
            stage9_finish: Vec::new(),
            stage8_pair_masks: Vec::new(),
            version: 0,
        }
    }
}
impl LegalTables {
    pub fn from_pack(bytes: &[u8]) -> Option<Self> {
        if bytes.len() < 5 || (&bytes[..4] != b"LGB1" && &bytes[..4] != b"LGB2") {
            return None;
        }
        let version = bytes[3] - b'0';
        let mut out = Self {
            version,
            ..Self::default()
        };
        let count = bytes[4] as usize;
        let mut pos = 5usize;
        for _ in 0..count {
            if pos + 5 > bytes.len() {
                return None;
            }
            let stage = bytes[pos] as usize;
            pos += 1;
            let len = u32::from_le_bytes(bytes[pos..pos + 4].try_into().ok()?) as usize;
            pos += 4;
            if stage >= out.stages.len() || pos + len > bytes.len() {
                return None;
            }
            let end = pos + len;
            out.stages[stage] = LegalStage::from_delta(stage, &bytes[pos..end])?;
            pos = end;
        }
        if version >= 2 {
            if pos >= bytes.len() {
                return None;
            }
            let oracle_count = bytes[pos] as usize;
            pos += 1;
            for _ in 0..oracle_count {
                if pos + 6 > bytes.len() {
                    return None;
                }
                let kind = bytes[pos];
                let stage = bytes[pos + 1] as usize;
                pos += 2;
                let len = u32::from_le_bytes(bytes[pos..pos + 4].try_into().ok()?) as usize;
                pos += 4;
                if pos + len > bytes.len() {
                    return None;
                }
                let payload = &bytes[pos..pos + len];
                pos += len;
                match (kind, stage) {
                    (ORACLE_STAGE9_PLACEMENTS, 9) => {
                        if payload.len() != out.stages[9].len() * 7 * 2 {
                            return None;
                        }
                        out.stage9_finish = payload
                            .chunks_exact(2)
                            .map(|x| u16::from_le_bytes([x[0], x[1]]))
                            .collect();
                    }
                    (ORACLE_STAGE8_PAIR_MASKS, 8) => {
                        if payload.len() != out.stages[8].len() * 7 {
                            return None;
                        }
                        out.stage8_pair_masks = payload.to_vec();
                    }
                    _ => return None,
                }
            }
        }
        if pos != bytes.len() {
            return None;
        }
        Some(out)
    }
    #[inline]
    pub fn accepts(&self, board: u64, height: u8) -> bool {
        if height != 4 {
            return true;
        }
        let pc = board.count_ones();
        if !pc.is_multiple_of(4) {
            return true;
        }
        let stage = (pc / 4) as usize;
        if stage >= self.stages.len() || self.stages[stage].len() == 0 {
            return true;
        }
        self.stages[stage].contains(board)
    }
    pub fn count(&self, stage: usize) -> usize {
        self.stages.get(stage).map_or(0, LegalStage::len)
    }
    #[inline]
    fn stage9_finish_code(&self, board: u64, piece: Piece) -> Option<Option<u16>> {
        if self.stage9_finish.is_empty() {
            return None;
        }
        let index = self.stages[9].find(board)?;
        let code = self.stage9_finish[index * 7 + piece as usize];
        Some((code != u16::MAX).then_some(code))
    }
    pub(crate) fn stage9_finish_placement(
        &self,
        board: u64,
        piece: Piece,
    ) -> Option<Option<Placement>> {
        let Some(code) = self.stage9_finish_code(board, piece) else {
            return if self.stage9_finish.is_empty() {
                None
            } else {
                Some(None)
            };
        };
        let Some(code) = code else {
            return Some(None);
        };
        let orientation = (code & 3) as u8;
        let x = ((code >> 2) & 0xf) as i8;
        let y = ((code >> 6) & 7) as i8;
        let cells = place_bits(piece, orientation, x, y);
        let raw_board = board | cells;
        let next = normalize_after_placement(raw_board, 4);
        if next != full_board(4) {
            return Some(None);
        }
        Some(Some(Placement {
            piece,
            orientation,
            x,
            y,
            board: next,
            raw_board,
            cells,
        }))
    }
    #[inline]
    pub(crate) fn stage8_pair_mask(&self, board: u64, first: Piece) -> Option<u8> {
        if self.stage8_pair_masks.is_empty() {
            return None;
        }
        let index = self.stages[8].find(board)?;
        Some(self.stage8_pair_masks[index * 7 + first as usize])
    }
    #[inline]
    pub fn version(&self) -> u8 {
        self.version
    }
    #[inline]
    pub fn stage8_oracle_entries(&self) -> usize {
        self.stage8_pair_masks.len()
    }
    #[inline]
    pub fn stage9_oracle_entries(&self) -> usize {
        self.stage9_finish.len()
    }
    pub fn memory_bytes(&self) -> usize {
        self.stages
            .iter()
            .map(LegalStage::memory_bytes)
            .sum::<usize>()
            + self.stage8_pair_masks.capacity()
            + self.stage9_finish.capacity() * size_of::<u16>()
    }
}
