Eigen headers are available in Source Code form under third_party/source/Eigen-3.4.0/.
These files retain their original MPL-2.0/permissive notices, and are not relicensed.
Upstream: https://gitlab.com/libeigen/eigen/-/tree/3147391d946bb4b6c68edd901f2add6ac1f31f8c
The CP-SAT bridge target defines EIGEN_MPL2_ONLY; this does not cover every static-library translation unit. This source set covers all Eigen dependencies recorded by Ninja, including a conservative superset of the final LTO-linked CP-SAT code.
