use std::collections::{HashMap, HashSet};
use std::hash::{BuildHasherDefault, Hasher};

#[derive(Default)]
pub struct FastHasher(u64);
impl Hasher for FastHasher {
    #[inline]
    fn finish(&self) -> u64 {
        self.0
    }
    #[inline]
    fn write(&mut self, bytes: &[u8]) {
        let mut h = self.0 ^ 0x517cc1b727220a95;
        for &b in bytes {
            h ^= b as u64;
            h = h.wrapping_mul(0x9e3779b185ebca87);
            h ^= h >> 29;
        }
        self.0 = h;
    }
    #[inline]
    fn write_u64(&mut self, i: u64) {
        let mut x = i.wrapping_add(0x9e3779b97f4a7c15);
        x = (x ^ (x >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
        x = (x ^ (x >> 27)).wrapping_mul(0x94d049bb133111eb);
        x ^= x >> 31;
        self.0 ^= x.wrapping_add(0x517cc1b727220a95);
        self.0 = self.0.rotate_left(27).wrapping_mul(0x94d049bb133111eb);
    }
    #[inline]
    fn write_usize(&mut self, i: usize) {
        self.write_u64(i as u64)
    }
    #[inline]
    fn write_u8(&mut self, i: u8) {
        self.write_u64(i as u64)
    }
}
pub type FastBuildHasher = BuildHasherDefault<FastHasher>;
pub type FastMap<K, V> = HashMap<K, V, FastBuildHasher>;
pub type FastSet<K> = HashSet<K, FastBuildHasher>;
