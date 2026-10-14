//! Exact per-geometry successful suffix languages for preferred-solution queries.
//! Original row mapping is part of the state; no colored geometry is merged.
use crate::{
    FastMap,
    dag::{CompactSolution, FlatDag, TERMINAL_NODE, map_placement_to_original},
    order_language::OrderLanguage,
};
use std::rc::Rc;
type Rows = FastMap<CompactSolution, u32>;
pub(crate) fn collect(
    height: u8,
    dag: &FlatDag,
    root: u32,
    cleared: u8,
    budget: usize,
) -> Option<(FastMap<CompactSolution, u32>, usize)> {
    struct Builder<'a> {
        height: u8,
        dag: &'a FlatDag,
        language: OrderLanguage,
        memo: FastMap<(u32, u8), Rc<Rows>>,
        entries: usize,
        budget: usize,
    }
    impl Builder<'_> {
        fn visit(&mut self, node: u32, cleared: u8) -> Option<Rc<Rows>> {
            if let Some(rows) = self.memo.get(&(node, cleared)) {
                return Some(Rc::clone(rows));
            }
            if self.memo.len() >= self.budget || self.entries >= 500_000 {
                return None;
            }
            let mut rows = Rows::default();
            for edge in self.dag.edges(node) {
                if edge.next != TERMINAL_NODE && self.dag.productive[edge.next as usize] != 2 {
                    continue;
                }
                let Some((next_cleared, mask)) = map_placement_to_original(
                    self.height,
                    cleared,
                    edge.piece,
                    edge.orientation,
                    edge.x,
                    edge.y,
                    edge.raw_board,
                ) else {
                    continue;
                };
                if edge.next == TERMINAL_NODE {
                    let color = CompactSolution::default().with_piece_mask(edge.piece, mask);
                    let word = self.language.prepend(edge.piece as usize, 1)?;
                    let old = rows.get(&color).copied().unwrap_or(0);
                    rows.insert(color, self.language.union(old, word)?);
                } else {
                    let suffix = self.visit(edge.next, next_cleared)?;
                    for (&color, &language) in suffix.iter() {
                        let color = color.with_piece_mask(edge.piece, mask);
                        let word = self.language.prepend(edge.piece as usize, language)?;
                        let old = rows.get(&color).copied().unwrap_or(0);
                        rows.insert(color, self.language.union(old, word)?);
                    }
                }
                if self.entries + rows.len() > 500_000 {
                    return None;
                }
            }
            self.entries += rows.len();
            let rows = Rc::new(rows);
            self.memo.insert((node, cleared), Rc::clone(&rows));
            Some(rows)
        }
    }
    if budget == 0 {
        return None;
    }
    let mut builder = Builder {
        height,
        dag,
        language: OrderLanguage::new(budget),
        memo: FastMap::default(),
        entries: 0,
        budget,
    };
    let rows = builder.visit(root, cleared)?;
    let counts = builder.language.counts();
    Some((
        rows.iter()
            .map(|(&color, &id)| (color, counts[id as usize].min(u32::MAX as u64) as u32))
            .collect(),
        builder.language.children.len(),
    ))
}
