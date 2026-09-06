//! Canonical acyclic successful-order language. Geometry paths with identical
//! suffix languages share one node. IDs 0/1 mean empty language/empty word.
use crate::{
    FastMap,
    dag::{FlatDag, TERMINAL_NODE},
};

pub(crate) struct OrderLanguage {
    node_budget: usize,
    pub(crate) children: Vec<[u32; 7]>,
    intern: FastMap<[u32; 7], u32>,
    unions: FastMap<(u32, u32), u32>,
}
impl OrderLanguage {
    fn node(&mut self, children: [u32; 7]) -> Option<u32> {
        if children == [0; 7] {
            return Some(0);
        }
        if let Some(&id) = self.intern.get(&children) {
            return Some(id);
        }
        if self.children.len() >= self.node_budget {
            return None;
        }
        let id = self.children.len() as u32;
        self.children.push(children);
        self.intern.insert(children, id);
        Some(id)
    }
    fn union(&mut self, a: u32, b: u32) -> Option<u32> {
        if a == b || b == 0 {
            return Some(a);
        }
        if a == 0 {
            return Some(b);
        }
        // Each geometry layer has a fixed remaining word length.
        debug_assert!(a > 1 && b > 1);
        let key = (a.min(b), a.max(b));
        if let Some(&id) = self.unions.get(&key) {
            return Some(id);
        }
        if self.unions.len() >= 1_000_000 {
            return None;
        }
        let mut children = [0; 7];
        for (p, child) in children.iter_mut().enumerate() {
            *child = self.union(self.children[a as usize][p], self.children[b as usize][p])?;
        }
        let id = self.node(children)?;
        self.unions.insert(key, id);
        Some(id)
    }
    fn suffix(&mut self, dag: &FlatDag, id: u32, memo: &mut [u32]) -> Option<u32> {
        if id == TERMINAL_NODE {
            return Some(1);
        }
        if dag.productive[id as usize] != 2 {
            return Some(0);
        }
        if memo[id as usize] != u32::MAX {
            return Some(memo[id as usize]);
        }
        let mut children = [0; 7];
        for edge in dag.edges(id) {
            let suffix = self.suffix(dag, edge.next, memo)?;
            let p = edge.piece as usize;
            children[p] = self.union(children[p], suffix)?;
        }
        let node = self.node(children)?;
        memo[id as usize] = node;
        Some(node)
    }
    pub(crate) fn path_count(dag: &FlatDag, roots: &[u32]) -> u64 {
        fn visit(dag: &FlatDag, node: u32, memo: &mut [u64]) -> u64 {
            if node == TERMINAL_NODE {
                return 1;
            }
            if dag.productive[node as usize] != 2 {
                return 0;
            }
            if memo[node as usize] != u64::MAX {
                return memo[node as usize];
            }
            let count = dag.edges(node).iter().fold(0u64, |sum, edge| {
                sum.saturating_add(visit(dag, edge.next, memo))
                    .min(1_000_000_000)
            });
            memo[node as usize] = count;
            count
        }
        let mut memo = vec![u64::MAX; dag.nodes.len()];
        roots.iter().fold(0u64, |sum, &root| {
            sum.saturating_add(visit(dag, root, &mut memo))
                .min(1_000_000_000)
        })
    }
    pub(crate) fn build(dag: &FlatDag, roots: &[u32], node_budget: usize) -> Option<(Self, u32)> {
        let mut language = Self {
            node_budget,
            children: vec![[0; 7]; 2],
            intern: FastMap::default(),
            unions: FastMap::default(),
        };
        let mut memo = vec![u32::MAX; dag.nodes.len()];
        let mut root = 0;
        for &id in roots {
            let suffix = language.suffix(dag, id, &mut memo)?;
            root = language.union(root, suffix)?;
        }
        // Construction interning and union workspaces are not retained during projection.
        language.intern = FastMap::default();
        language.unions = FastMap::default();
        Some((language, root))
    }
}
