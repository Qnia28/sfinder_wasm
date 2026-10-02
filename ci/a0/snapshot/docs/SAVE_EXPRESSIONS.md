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
Every unused copy in the queue is counted, plus any undrawn piece in the final
bag. There is no seven-copies-per-kind save-expression limit. For example, when
only I is placed from queue ITT, the exact outcome is TT in both commands.

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
Whitespace outside regex literals is ignored; whitespace inside `/.../` remains
part of the regex. Each `!` or `^` prefix applies only to the next atom or grouped
expression: `!O&&T` equals `(!O)&&T`, not `(!O)&&(!T)`. Repeated identical prefixes
cancel in pairs. If `!` and `^` are combined before a queue-level atom, the
historical evaluator applies complement first, then the no-match test.

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
Mixed `&&` and `||` are evaluated **left to right** at queue level, unless grouped.
For example, `T||I&&O` means `(T||I)&&O` here. This compatibility behavior differs
from the scalar minimals precedence below; it does not include the former bug
where a unary modifier leaked into later terms.

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
Scalar minimals uses unary prefixes first, then **`&&` before `||`**, with grouping
overriding precedence. Thus `T||I&&O` means `T||(I&&O)` and matches an outcome T.
This preserves the original scalar condition contract while retaining exact
multiplicity. The distinct-piece internal truth table uses the scalar precedence
as well, but its seven-bit presence masks intentionally do not count duplicates.

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
