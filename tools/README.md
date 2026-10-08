# midad-style

Python tools for **style packages** (`styles/<id>/`): the compiler that turns
a source font + `style.toml` into the font the engine loads, and an
inspector for fonts.

```bash
pip install -e tools            # once (add [test] for pytest)

python -m midad_style inspect styles/naskh-amiri/source/Amiri-Regular.ttf
python -m midad_style compile styles/naskh-amiri
python -m midad_style check   styles/*        # what CI runs
```

See `docs/STYLE_FORMAT.md` for the package layout and every manifest key.
