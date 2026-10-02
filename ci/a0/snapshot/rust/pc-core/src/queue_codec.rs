use super::*;

pub fn decode_queue_bits(bits: u64, len: u8) -> Option<Vec<Piece>> {
    if len > 21 {
        return None;
    }
    let mut out = Vec::with_capacity(len as usize);
    for i in 0..len {
        out.push(Piece::from_u8(((bits >> (i as u32 * 3)) & 7) as u8)?)
    }
    Some(out)
}
pub fn decode_queue_array(bits: u64, len: u8) -> Option<([Piece; 21], usize)> {
    if len > 21 {
        return None;
    }
    let mut out = [Piece::I; 21];
    for i in 0..len {
        out[i as usize] = Piece::from_u8(((bits >> (i as u32 * 3)) & 7) as u8)?;
    }
    Some((out, len as usize))
}
pub fn encode_queue_ascii(s: &str) -> Option<u64> {
    if s.len() > 21 {
        return None;
    }
    let mut bits = 0u64;
    for (i, c) in s.bytes().enumerate() {
        bits |= (Piece::from_char(c)? as u64) << (i * 3)
    }
    Some(bits)
}
