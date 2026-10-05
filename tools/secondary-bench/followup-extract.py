"""Exact ZIP-size disk admission before extraction; one owned archive at a time."""
import json
import pathlib
import shutil
import stat
import sys
import zipfile


def extract(archive, destination, reserve_bytes):
    root = pathlib.Path(destination).resolve()
    assert not root.exists(), 'artifact destination must be new'
    with zipfile.ZipFile(archive) as bundle:
        names = set()
        needed = 0
        for entry in bundle.infolist():
            assert '\\' not in entry.filename, 'nonportable artifact path'
            target = (root / entry.filename).resolve()
            assert target == root or root in target.parents, 'unsafe artifact member'
            assert target not in names, 'duplicate artifact member'
            names.add(target)
            assert not stat.S_ISLNK(entry.external_attr >> 16), 'artifact symlink forbidden'
            assert not entry.flag_bits & 1, 'encrypted artifact forbidden'
            # Include block/inode overhead, not only logical JSON bytes.
            needed += ((entry.file_size + 4095) // 4096 + 1) * 4096
        available = shutil.disk_usage(root.parent).free
        admission = dict(availableBytes=available, neededBytes=needed,
                         reserveBytes=reserve_bytes, members=len(names))
        assert needed + reserve_bytes <= available, 'INSUFFICIENT_DISK_SPACE ' + json.dumps(admission)
        root.mkdir()
        bundle.extractall(root)
        return dict(admission, admitted=True)


if __name__ == '__main__':
    print(json.dumps(extract(sys.argv[1], sys.argv[2], int(sys.argv[3]))))
