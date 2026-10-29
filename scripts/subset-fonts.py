# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.60.1"]
# ///
"""Subset the site's web fonts into a preloaded core file and an on-demand extended file.

Run by hand from the repository root, then commit the output:

    uv run scripts/subset-fonts.py

Rerun it when content gains a character outside ASCII, Latin-1 and Latin Extended-A
(an arrow, a currency sign, a symbol), when CSS starts using a new font weight,
OpenType feature or variation axis, or when bumping SOURCE_COMMIT.

Writes src/assets/fonts/*.woff2 and src/styles/fonts.css.
"""

import io
import unicodedata
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / "src/assets/fonts"
CSS_PATH = ROOT / "src/styles/fonts.css"

# google/fonts is the source Google Fonts serves from. Pinning a commit keeps reruns reproducible.
SOURCE_COMMIT = "6157dfaa640ca5738b4d1a7070fe389c3036d7fc"
SOURCE_URL = f"https://raw.githubusercontent.com/google/fonts/{SOURCE_COMMIT}/ofl"

# Features are the ones browsers turn on by default that each font registers for Latin,
# plus tnum for `font-variant-numeric: tabular-nums`. mark and mkmk place combining
# accents for letters the font draws from a base letter and a mark.
FONTS = [
    {
        "family": "Inter",
        "slug": "inter",
        "source": "inter/Inter%5Bopsz,wght%5D.ttf",
        # Google Fonts serves opsz pinned at its default, and the site only sets weights 400 to 700.
        "axes": {"opsz": 14, "wght": (400, 700)},
        # Separate faces, as Google Fonts serves them, so weights like 650 still snap to 700.
        "weights": ["400", "500", "600", "700"],
        "features": ["calt", "ccmp", "kern", "mark", "mkmk", "tnum"],
    },
    {
        "family": "Lacquer",
        "slug": "lacquer",
        "source": "lacquer/Lacquer-Regular.ttf",
        "weights": ["400"],
        "features": ["ccmp", "kern", "mark", "mkmk"],
    },
    {
        "family": "Rubik Marker Hatch",
        "slug": "rubik-marker-hatch",
        "source": "rubikmarkerhatch/RubikMarkerHatch-Regular.ttf",
        "weights": ["400"],
        "features": ["ccmp", "kern", "liga", "mark", "mkmk"],
    },
]

PUNCTUATION = "–—‘’“”…"
# Letters only kern against letters in the same file, so all Latin letters stay in core.
# The site header renders the north-east arrow on every page.
LATIN = {*range(0x20, 0x7F), *range(0xA0, 0x180)}
CORE = LATIN | {*map(ord, PUNCTUATION), 0x2197}
CONTENT_SUFFIXES = {".astro", ".css", ".json", ".md", ".mdx", ".ts", ".tsx"}


def content_codepoints() -> set[int]:
    """Collect every non-ASCII character written in src/, skipping tests."""
    codepoints = set()
    for path in (ROOT / "src").rglob("*"):
        if path.suffix in CONTENT_SUFFIXES and ".test." not in path.name:
            codepoints.update(ord(char) for char in path.read_text(encoding="utf-8") if ord(char) > 0x7E)
    return codepoints


def unicode_range(codepoints: set[int]) -> str:
    ranges = []
    for codepoint in sorted(codepoints):
        if ranges and codepoint == ranges[-1][1] + 1:
            ranges[-1][1] = codepoint
        else:
            ranges.append([codepoint, codepoint])
    return ", ".join(f"U+{start:04X}" if start == end else f"U+{start:04X}-{end:04X}" for start, end in ranges)


def write_subset(source: bytes, codepoints: set[int], features: list[str], path: Path) -> set[int]:
    """Write a WOFF2 subset and return the codepoints it actually maps."""
    options = subset.Options()
    options.layout_features = features
    options.hinting = False
    options.name_IDs = ["*"]
    options.drop_tables += ["STAT", "DSIG"]
    font = TTFont(io.BytesIO(source), recalcTimestamp=False)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(path)
    return set(TTFont(path).getBestCmap())


def composable(codepoints: set[int], available: set[int]) -> set[int]:
    """Characters the font lacks but can draw from a base letter and combining marks it has."""
    found = set()
    for codepoint in codepoints - available:
        parts = [ord(char) for char in unicodedata.normalize("NFD", chr(codepoint))]
        if len(parts) > 1 and set(parts) <= available:
            found.add(codepoint)
    return found


def font_face(family: str, weight: str, file_name: str, codepoints: set[int]) -> str:
    return (
        "@font-face {\n"
        f'  font-family: "{family}";\n'
        "  font-style: normal;\n"
        f"  font-weight: {weight};\n"
        "  font-display: swap;\n"
        f'  src: url("../assets/fonts/{file_name}") format("woff2");\n'
        f"  unicode-range: {unicode_range(codepoints)};\n"
        "}\n"
    )


def main() -> None:
    wanted = LATIN | CORE | content_codepoints()
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    faces = []
    written = set()
    for config in FONTS:
        with urllib.request.urlopen(f"{SOURCE_URL}/{config['source']}") as response:
            font = TTFont(io.BytesIO(response.read()), recalcTimestamp=False)
        if "axes" in config:
            font = instancer.instantiateVariableFont(font, config["axes"])
        source = io.BytesIO()
        font.save(source)
        available = set(font.getBestCmap())
        # Core is declared last so it wins wherever ranges overlap and extended loads only when needed.
        for part, part_wanted in {"extended": wanted - CORE, "core": wanted & CORE}.items():
            # Chrome composes a letter only from glyphs in one file and inside that file's
            # unicode-range (checked in its renderer), so the file lists the base letters and marks.
            composed = composable(part_wanted, available)
            components = {ord(char) for codepoint in composed for char in unicodedata.normalize("NFD", chr(codepoint))}
            file_name = f"{config['slug']}-{part}.woff2"
            mapped = write_subset(
                source.getvalue(), (part_wanted & available) | components, config["features"], FONT_DIR / file_name
            )
            written.add(file_name)
            for weight in config["weights"]:
                faces.append(font_face(config["family"], weight, file_name, mapped | composed))
            print(f"{file_name}: {len(mapped)} characters, {(FONT_DIR / file_name).stat().st_size} bytes")
    for stale in FONT_DIR.glob("*.woff2"):
        if stale.name not in written:
            stale.unlink()
    CSS_PATH.write_text(
        "/* Generated by scripts/subset-fonts.py. Edit the script and rerun it instead of editing this file. */\n\n"
        + "\n".join(faces)
    )


if __name__ == "__main__":
    main()
