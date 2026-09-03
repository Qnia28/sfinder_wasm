# Save-expression reference

This document defines the current save-expression behavior. The most important
rule is that **`saves` and `minimals` do not evaluate expressions at the same
level**.

## Exact save strings

Save outcomes use tetromino letters in deterministic Tetris order and preserve
multiplicity. Examples:

```text
T
TI
TT
TTILSZ
```

`TT` is not collapsed to `T`.

## Operators

Supported forms include:

```text
T            contains T
TI           contains T and I in the same exact outcome
T||I         logical OR
T&&I         logical AND under the command's evaluation model
^T           avoid / complement-style condition
!T           negate / no-match condition
(T||I)&&!O   grouping
/TT/         JavaScript regular expression against exact save strings
```

Whitespace around operators is accepted by the current parser.

## `saves`: queue-level semantics

For one queue, `saves` first enumerates the set of all exact save outcomes.
Expressions are evaluated against that whole set.

Assume a queue has exactly two possible save outcomes:

```text
{ I, J }
```

Then:

```text
I       true
IJ      false      no single outcome contains both
I&&J    true       I is saveable and J is saveable via possibly different outcomes
^I      true       J is an outcome that avoids I
!I      false      I is still possible somewhere
```

This reproduces the intended historical `ezsaves percent` behavior.

### ALL / omitted expression

For `saves`, all of the following select all-outcomes mode:

```text
wantedSave omitted
wantedSave: ""
wantedSave: "ALL"
```

The result contains `saveResults`, with one entry per distinct exact save string:

```js
{
  save: 'TTILSZ',
  success: 20,
  total: 1008,
  percent: 1.984...
}
```

A queue can contribute to multiple save results because several outcomes can be
possible for the same queue.

### Multiple expressions

These are equivalent input forms:

```js
wantedSave: '^T,!T,SZ,S&&Z'
```

```js
wantedSave: ['^T', '!T', 'SZ', 'S&&Z']
```

Enumeration is performed once. Each expression is evaluated independently and
returned in `wantedSaveResults` in input order. `ALL` cannot be combined with
other expressions.

### Alias

`saves` accepts:

```text
expression#alias
```

Example:

```text
TT#T>X
```

The expression is `TT`; `T>X` is display metadata. Single-expression results
include `saveExpression`, `saveAlias`, and `saveLabel`.

## `minimals` and `legacy-minimals`: solution-level semantics

Minimals evaluates the filter separately for each concrete solution's exact
saved multiset. It does **not** aggregate all save outcomes for a queue first.

For one solution whose exact save result is `I`:

```text
^I   false
!I   false
IJ   false
I&&J false
```

For one solution whose exact save result is `IJ`:

```text
IJ   true
I&&J true
```

Therefore, under one-outcome minimals filtering:

```text
^X   and !X     are equivalent for that outcome
XY   and X&&Y   are equivalent for that outcome
```

This difference from `saves` is intentional and preserves the historical
solution-filter model.

### Exact multiplicity

Minimals preserves repeated pieces:

```text
T   != TT
TT  != TTT
```

Regex sees the exact save string, so `/TT/` can match a double-T outcome.

### ALL / omitted filter

For `minimals` and `legacy-minimals`:

```text
wantedSave omitted
wantedSave: ""
wantedSave: "ALL"
```

all mean **no save filter**.

## Internal fixed filters

`fourth` and `fifth` use internal positive/distinct-piece save predicates. They
do not expose the general `wantedSave` API. `per-save-minimals` and
`per-save-all` group by the saved piece directly and do not parse save
expressions.
