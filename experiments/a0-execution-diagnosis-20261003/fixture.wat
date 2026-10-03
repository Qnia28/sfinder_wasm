(module
  (func $spinA (export "spinA") (param $n i32) (result i32)
    (local $x i32)
    (loop $again
      local.get $x i32.const 7 i32.add local.set $x
      local.get $n i32.const 1 i32.sub local.tee $n br_if $again)
    local.get $x)
  (func $spinB (export "spinB") (param $n i32) (result i32)
    (local $x i32)
    (loop $again
      local.get $x i32.const 9 i32.add local.set $x
      local.get $n i32.const 1 i32.sub local.tee $n br_if $again)
    local.get $x)
  (func $shared (param i32) (result i32)
    local.get 0 call $spinA)
  (func $recursive (export "recursive") (param $depth i32) (param $n i32) (result i32)
    local.get $depth
    if (result i32)
      local.get $depth i32.const 1 i32.sub local.get $n call $recursive
      i32.const 1 i32.add
    else
      local.get $n call $shared
    end))
