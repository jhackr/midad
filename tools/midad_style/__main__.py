"""Command line entry point.

    python -m midad_style compile styles/naskh-amiri     # build dist/
    python -m midad_style check   styles/*               # CI: is dist/ up to date?
    python -m midad_style inspect path/to/font.ttf       # what does this font offer?
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .compile import compile_style, is_up_to_date
from .inspect_font import inspect


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="midad_style", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    p_compile = sub.add_parser("compile", help="build a style package")
    p_compile.add_argument("styles", nargs="+", type=Path)

    p_check = sub.add_parser("check", help="fail if a style's dist/ is stale")
    p_check.add_argument("styles", nargs="+", type=Path)

    p_inspect = sub.add_parser("inspect", help="describe a font")
    p_inspect.add_argument("font", type=Path)

    args = parser.parse_args(argv)

    if args.command == "compile":
        for style in args.styles:
            report = compile_style(style)
            print(f"✓ {style} → {report.output}")
            for key, value in report.alternates.items():
                print(f"    {key}: {value}")
        return 0

    if args.command == "check":
        failed = False
        for style in args.styles:
            if not (style / "style.toml").exists():
                continue
            ok, reason = is_up_to_date(style)
            print(f"{'✓' if ok else '✗'} {style}: {reason}")
            failed |= not ok
        return 1 if failed else 0

    if args.command == "inspect":
        print(inspect(args.font))
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
