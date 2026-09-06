use crate::Piece;

const NO_TRIE_CHILD: u32 = u32::MAX;

#[derive(Clone, Copy, Debug)]
struct QueueTrieNode {
    children: [u32; 7],
    // DFS-preorder interval invariant: perm[dfs_lo..dfs_hi] are all original
    // case IDs in this node's subtree; perm[dfs_lo..dfs_lo+terminal_len] are
    // this node's own terminals only (used for ended-state coverage).
    dfs_lo: u32,
    dfs_hi: u32,
    terminal_len: u32,
}
impl Default for QueueTrieNode {
    fn default() -> Self {
        Self {
            children: [NO_TRIE_CHILD; 7],
            dfs_lo: 0,
            dfs_hi: 0,
            terminal_len: 0,
        }
    }
}

// Prefix-sharing Hold automaton for pattern-level coverage projection. Each
// normal trie position represents every concrete queue with that prefix; an
// ended position narrows the state to queues ending at exactly that node.
//
// Terminals are emitted in deterministic DFS preorder (own terminals first,
// then children in piece-index order I..Z), so every subtree is a contiguous
// perm[dfs_lo..dfs_hi) interval. perm[i] maps DFS index i to the original
// caller-supplied case ID.
pub struct QueueTrie {
    nodes: Vec<QueueTrieNode>,
    pub perm: Vec<u32>,
    pub words: usize,
}

pub struct QueueTrieScratch {
    state_seen: Vec<u32>,
    position_seen: Vec<u32>,
    cur: Vec<u32>,
    next: Vec<u32>,
    generation: u32,
}
impl QueueTrieScratch {
    pub fn new(node_count: usize) -> Self {
        Self {
            state_seen: vec![0u32; node_count * 16],
            position_seen: vec![0u32; node_count * 2],
            cur: Vec::with_capacity(256),
            next: Vec::with_capacity(256),
            generation: 0,
        }
    }

    fn next_generation(&mut self) -> u32 {
        self.generation = self.generation.wrapping_add(1);
        if self.generation == 0 {
            self.state_seen.fill(0);
            self.position_seen.fill(0);
            self.generation = 1;
        }
        self.generation
    }
}

impl QueueTrie {
    #[inline]
    pub fn node_count(&self) -> usize {
        self.nodes.len()
    }

    pub fn new(qbits: &[u64], qlens: &[u8]) -> Option<Self> {
        if qbits.len() != qlens.len() || qlens.iter().any(|&len| len > 21) {
            return None;
        }
        let mut nodes = vec![QueueTrieNode::default()];
        let mut terminal_pairs = Vec::with_capacity(qbits.len());
        for (case, (&bits, &len)) in qbits.iter().zip(qlens).enumerate() {
            let mut node = 0u32;
            for index in 0..len {
                let piece = Piece::from_u8(((bits >> (index as u32 * 3)) & 7) as u8)? as usize;
                let child = nodes[node as usize].children[piece];
                node = if child == NO_TRIE_CHILD {
                    let child = nodes.len() as u32;
                    nodes.push(QueueTrieNode::default());
                    nodes[node as usize].children[piece] = child;
                    child
                } else {
                    child
                };
            }
            terminal_pairs.push((node, case as u32));
        }
        // Sort by (node, case) so each node's own terminals are in ascending
        // case-ID order within their DFS-preorder slice.
        terminal_pairs.sort_unstable_by_key(|&(node, case)| (node, case));

        // Build per-node terminal ranges into terminal_pairs.
        let n = nodes.len();
        let mut node_term_start = vec![0usize; n];
        let mut node_term_end = vec![0usize; n];
        {
            let mut i = 0usize;
            while i < terminal_pairs.len() {
                let node = terminal_pairs[i].0 as usize;
                node_term_start[node] = i;
                while i < terminal_pairs.len() && terminal_pairs[i].0 as usize == node {
                    i += 1;
                }
                node_term_end[node] = i;
            }
        }

        // DFS preorder emission: for each node, first emit own terminals, then
        // recurse into children (piece-index order I..Z). This makes every
        // subtree a contiguous perm[] interval.
        let mut perm = Vec::with_capacity(qbits.len());
        Self::dfs_emit(
            &mut nodes,
            &terminal_pairs,
            &node_term_start,
            &node_term_end,
            0,
            &mut perm,
        );

        let words = qbits.len().div_ceil(64);
        Some(Self { nodes, perm, words })
    }

    fn dfs_emit(
        nodes: &mut Vec<QueueTrieNode>,
        pairs: &[(u32, u32)],
        term_start: &[usize],
        term_end: &[usize],
        node: usize,
        perm: &mut Vec<u32>,
    ) {
        let dfs_lo = perm.len() as u32;
        let ts = term_start[node];
        let te = term_end[node];
        perm.extend(pairs[ts..te].iter().map(|pr| pr.1));
        let terminal_len = (te - ts) as u32;
        // Copy children to avoid conflicting borrows when recursing.
        let children = nodes[node].children;
        for &child in &children {
            if child != NO_TRIE_CHILD {
                Self::dfs_emit(nodes, pairs, term_start, term_end, child as usize, perm);
            }
        }
        nodes[node].dfs_lo = dfs_lo;
        nodes[node].dfs_hi = perm.len() as u32;
        nodes[node].terminal_len = terminal_len;
    }

    // Set bits [lo, hi) in the coverage word slice (all indices are DFS positions).
    #[inline]
    fn set_bit_range(bits: &mut [u64], lo: usize, hi: usize) {
        if lo >= hi {
            return;
        }
        let lo_word = lo / 64;
        let hi_last = hi - 1;
        let hi_word = hi_last / 64;
        if lo_word == hi_word {
            bits[lo_word] |= ((!0u64) << (lo % 64)) & ((!0u64) >> (63 - hi_last % 64));
        } else {
            bits[lo_word] |= (!0u64) << (lo % 64);
            bits[(lo_word + 1)..hi_word].fill(!0u64);
            let hi_mod = hi % 64;
            bits[hi_word] |= if hi_mod == 0 {
                !0u64
            } else {
                (1u64 << hi_mod) - 1
            };
        }
    }

    #[inline]
    fn push_state(next: &mut Vec<u32>, seen: &mut [u32], generation: u32, state: u32) {
        let slot = &mut seen[state as usize];
        if *slot != generation {
            *slot = generation;
            next.push(state);
        }
    }

    #[inline]
    fn normal_state(node: u32, hold: u8) -> u32 {
        (node << 3) | hold as u32
    }

    #[inline]
    fn ended_state(node: u32, hold: u8, node_count: u32) -> u32 {
        ((node_count + node) << 3) | hold as u32
    }

    fn advance(&self, state: u32, wanted: u8, use_hold: bool) -> impl Iterator<Item = u32> {
        let mut out = [0u32; 9];
        let mut len = 0;
        let mut push = |value| {
            out[len] = value;
            len += 1;
        };
        let node_count = self.nodes.len() as u32;
        let hold = (state & 7) as u8;
        let pos = state >> 3;
        if pos >= node_count {
            if use_hold && hold == wanted {
                push(Self::ended_state(pos - node_count, 7, node_count));
            }
        } else {
            let meta = &self.nodes[pos as usize];
            let direct = meta.children[wanted as usize];
            if direct != NO_TRIE_CHILD {
                push(Self::normal_state(direct, hold));
            }
            if use_hold {
                if hold == 7 {
                    for current in 0..7usize {
                        let first = meta.children[current];
                        if first == NO_TRIE_CHILD {
                            continue;
                        }
                        let second = self.nodes[first as usize].children[wanted as usize];
                        if second != NO_TRIE_CHILD {
                            push(Self::normal_state(second, current as u8));
                        }
                    }
                } else if hold == wanted {
                    for current in 0..7usize {
                        let child = meta.children[current];
                        if child != NO_TRIE_CHILD {
                            push(Self::normal_state(child, current as u8));
                        }
                    }
                    if meta.terminal_len != 0 {
                        push(Self::ended_state(pos, 7, node_count));
                    }
                }
            }
        }
        out.into_iter().take(len)
    }

    pub(crate) fn coverage_for_language(
        &self,
        language: &crate::order_language::OrderLanguage,
        root: u32,
        use_hold: bool,
    ) -> Option<Vec<u64>> {
        let mut covered = vec![0u64; self.words];
        let mut seen = crate::FastSet::default();
        let mut stack = vec![(root, Self::normal_state(0, 7))];
        while let Some((id, state)) = stack.pop() {
            if id == 0 || !seen.insert((id, state)) {
                continue;
            }
            if seen.len() > 1_000_000 {
                return None;
            }
            if id == 1 {
                let pos = (state >> 3) as usize;
                let n = &self.nodes[pos % self.nodes.len()];
                let hi = if pos < self.nodes.len() {
                    n.dfs_hi
                } else {
                    n.dfs_lo + n.terminal_len
                };
                Self::set_bit_range(&mut covered, n.dfs_lo as usize, hi as usize);
                continue;
            }
            for (piece, &child) in language.children[id as usize].iter().enumerate() {
                if child != 0 {
                    for next in self.advance(state, piece as u8, use_hold) {
                        stack.push((child, next));
                    }
                }
            }
        }
        Some(covered)
    }

    pub fn coverage_for_order(
        &self,
        order_bits: u64,
        depth: u8,
        use_hold: bool,
        scratch: &mut QueueTrieScratch,
    ) -> Vec<u64> {
        let node_count = self.nodes.len() as u32;
        scratch.cur.clear();
        scratch.next.clear();
        scratch.cur.push(Self::normal_state(0, 7));

        for step in 0..depth {
            let code = ((order_bits >> (step as u32 * 3)) & 7) as u8;
            if code == 0 {
                return vec![0u64; self.words];
            }
            let wanted = code - 1;
            let generation = scratch.next_generation();
            scratch.next.clear();
            for &state in &scratch.cur {
                for next in self.advance(state, wanted, use_hold) {
                    Self::push_state(&mut scratch.next, &mut scratch.state_seen, generation, next);
                }
            }
            if scratch.next.is_empty() {
                return vec![0u64; self.words];
            }
            std::mem::swap(&mut scratch.cur, &mut scratch.next);
        }

        // Accumulate coverage as a bitmap over DFS positions. Each set bit at
        // position i means perm[i] (an original case ID) is covered. Consumers
        // must map through perm[] before writing public original-case output.
        let mut covered = vec![0u64; self.words];
        let generation = scratch.next_generation();
        for &state in &scratch.cur {
            let pos = state >> 3;
            let slot = &mut scratch.position_seen[pos as usize];
            if *slot == generation {
                continue;
            }
            *slot = generation;
            let (lo, hi) = if pos < node_count {
                let n = &self.nodes[pos as usize];
                (n.dfs_lo as usize, n.dfs_hi as usize)
            } else {
                let n = &self.nodes[(pos - node_count) as usize];
                let lo = n.dfs_lo as usize;
                (lo, lo + n.terminal_len as usize)
            };
            Self::set_bit_range(&mut covered, lo, hi);
        }
        covered
    }
}
