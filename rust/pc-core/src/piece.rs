#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
#[repr(u8)]
pub enum Piece {
    I = 0,
    J = 1,
    L = 2,
    O = 3,
    S = 4,
    T = 5,
    Z = 6,
}
impl Piece {
    pub const ALL: [Piece; 7] = [
        Self::I,
        Self::J,
        Self::L,
        Self::O,
        Self::S,
        Self::T,
        Self::Z,
    ];
    pub fn from_u8(v: u8) -> Option<Self> {
        Some(match v {
            0 => Self::I,
            1 => Self::J,
            2 => Self::L,
            3 => Self::O,
            4 => Self::S,
            5 => Self::T,
            6 => Self::Z,
            _ => return None,
        })
    }
    pub fn from_char(c: u8) -> Option<Self> {
        Some(match c {
            b'I' => Self::I,
            b'J' => Self::J,
            b'L' => Self::L,
            b'O' => Self::O,
            b'S' => Self::S,
            b'T' => Self::T,
            b'Z' => Self::Z,
            _ => return None,
        })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Physics {
    Jstris,
    Tetrio,
}
