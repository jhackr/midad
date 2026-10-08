//! Small Arabic text helpers (words, diacritics).

use std::ops::Range;

pub const TATWEEL: char = '\u{0640}';

/// Arabic combining marks (harakat, Quranic marks, superscript alef…).
pub fn is_arabic_mark(c: char) -> bool {
    matches!(c as u32,
        0x0610..=0x061A
        | 0x064B..=0x065F
        | 0x0670
        | 0x06D6..=0x06DC
        | 0x06DF..=0x06E4
        | 0x06E7..=0x06E8
        | 0x06EA..=0x06ED
        | 0x08CA..=0x08E1
        | 0x08E3..=0x08FF)
}

/// Characters that belong to a word (letters, digits, marks, tatweel, ZWJ/ZWNJ).
pub fn is_word_char(c: char) -> bool {
    c.is_alphanumeric() || is_arabic_mark(c) || c == TATWEEL || c == '\u{200C}' || c == '\u{200D}'
}

/// The word containing char `i` (empty range if `i` is not a word char).
pub fn word_at(chars: &[char], i: usize) -> Range<usize> {
    if i >= chars.len() || !is_word_char(chars[i]) {
        return i..i;
    }
    let mut start = i;
    while start > 0 && is_word_char(chars[start - 1]) {
        start -= 1;
    }
    let mut end = i + 1;
    while end < chars.len() && is_word_char(chars[end]) {
        end += 1;
    }
    start..end
}

/// Remove diacritics and tatweel: "اللَّه" → "الله".
pub fn strip_marks(chars: &[char]) -> String {
    chars
        .iter()
        .filter(|c| !is_arabic_mark(**c) && **c != TATWEEL)
        .collect()
}

/// Index of the last non-mark char at or before `i`.
pub fn base_at_or_before(chars: &[char], i: usize) -> Option<usize> {
    (0..=i.min(chars.len().checked_sub(1)?))
        .rev()
        .find(|&k| !is_arabic_mark(chars[k]))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn chars(s: &str) -> Vec<char> {
        s.chars().collect()
    }

    #[test]
    fn words() {
        let c = chars("بسم الله");
        assert_eq!(word_at(&c, 1), 0..3);
        assert_eq!(word_at(&c, 5), 4..8);
        assert_eq!(word_at(&c, 3), 3..3);
    }

    #[test]
    fn strips_harakat() {
        assert_eq!(strip_marks(&chars("اللَّهِ")), "الله");
    }

    #[test]
    fn base_skips_marks() {
        let c = chars("بَس");
        assert_eq!(base_at_or_before(&c, 1), Some(0));
    }
}
