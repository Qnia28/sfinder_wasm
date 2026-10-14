use super::*;

fn words(len: u8) -> Vec<u64> {
    if len == 0 {
        return vec![0];
    }
    words(len - 1)
        .into_iter()
        .flat_map(|prefix| [0u64, 3, 5].map(|p| prefix | (p << ((len - 1) * 3))))
        .collect()
}

#[test]
fn trie_and_multisets_preserve_scalar_hold_language() {
    for qlen in 1..=4 {
        for queue in words(qlen) {
            for use_hold in [false, true] {
                let mut cache = QueuePrefixCache::new(&[(queue, qlen)], use_hold);
                for len in 0..=qlen.min(3) {
                    let roots =
                        pc_core::PcSolver::pattern_multiset_roots(&[queue], &[qlen], len, use_hold);
                    for order in words(len) {
                        let scalar = queue_buildable(queue, qlen, order, len, use_hold);
                        assert_eq!(cache.any(order, len), scalar);
                        if scalar {
                            let mut counts = 0u32;
                            for i in 0..len {
                                counts += 1 << (order_piece(order, i as usize) * 4);
                            }
                            assert!(roots.contains(&counts));
                        }
                    }
                }
            }
        }
    }
    let mut empty = QueuePrefixCache::new(&[], true);
    assert!(!empty.any(0, 0));
}

#[test]
fn congruent_pruning_matches_complete_variant_enumeration() {
    let operations = vec![
        BatchOperation {
            piece: Piece::O,
            mask: 3 | (3 << 10),
        },
        BatchOperation {
            piece: Piece::O,
            mask: (3 | (3 << 10)) << 2,
        },
        BatchOperation {
            piece: Piece::T,
            mask: (7 << 4) | (1 << 15),
        },
    ];
    for physics in [Physics::Jstris, Physics::Tetrio] {
        for use_hold in [false, true] {
            let mut ws = BatchWorkspace {
                operations: operations.clone(),
                ..Default::default()
            };
            assert!(run_variant_engine(&mut ws, 0, 4, physics, 0));
            for q in words(4) {
                let mut expected = FastSet::default();
                for v in &ws.variants {
                    let mut order = 0;
                    for i in 0..operations.len() {
                        order |= (operations[((v.ids >> (i * 4)) & 15) as usize].piece as u64)
                            << (i * 3);
                    }
                    if queue_buildable(q, 4, order, 3, use_hold) {
                        expected.insert(order);
                    }
                }
                let actual = valid_orders_for_tiling(
                    0,
                    &operations,
                    &mut QueuePrefixCache::new(&[(q, 4)], use_hold),
                    4,
                    physics,
                );
                assert_eq!(actual.into_iter().collect::<FastSet<_>>(), expected);
            }
        }
    }
}

#[test]
fn incremental_frontier_matches_full_projection_and_original_case_ids() {
    let queues = [(0u64, 1u8), (3, 1), (3, 1), (3 << 3, 2), (5 | (3 << 3), 2)];
    for hold in [false, true] {
        let mut cache = QueuePrefixCache::new(&queues, hold);
        for len in 0..=3 {
            for order in words(len) {
                let mut frontier = 0;
                for i in 0..len {
                    if frontier == u32::MAX {
                        break;
                    }
                    frontier = cache
                        .advance(
                            frontier,
                            Piece::from_u8(order_piece(order, i as usize)).unwrap(),
                            200_000,
                        )
                        .unwrap();
                }
                let bits = if frontier == u32::MAX {
                    vec![0; cache.trie.words]
                } else {
                    cache
                        .trie
                        .coverage_for_frontier(&cache.frontiers[frontier as usize])
                };
                assert_eq!(bits.as_slice(), cache.viable(order, len).as_ref());
            }
        }
    }
}
