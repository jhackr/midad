//! Where may a kashida (tatweel elongation) go?
//!
//! Two filters, in this order:
//! 1. **Safety** — the shaper itself reports, per glyph, whether inserting
//!    U+0640 before that cluster keeps the joining intact
//!    (`HB_GLYPH_FLAG_SAFE_TO_INSERT_TATWEEL`). This handles the Unicode
//!    joining rules: no kashida after a non-joining letter, inside a
//!    ligature, etc.
//! 2. **Style rules** — calligraphic conventions from `style.toml`
//!    (`[kashida]`): letters it never precedes/follows, excluded words, and a
//!    per-word limit (enforced by the composer).

use crate::manifest::KashidaRules;
use crate::text::{base_at_or_before, strip_marks, word_at};

/// Does the style allow a kashida between `chars[after]` and `chars[after + 1]`?
/// (Safety has already been checked by the shaper.)
pub fn rules_allow(rules: &KashidaRules, chars: &[char], after: usize) -> bool {
    if !rules.enabled || after + 1 >= chars.len() {
        return false;
    }
    let next = chars[after + 1];
    if rules.never_before.iter().any(|s| s.chars().eq([next])) {
        return false;
    }
    if let Some(prev) = base_at_or_before(chars, after) {
        let prev = chars[prev];
        if rules.never_after.iter().any(|s| s.chars().eq([prev])) {
            return false;
        }
    }
    let word = word_at(chars, after);
    if !word.contains(&(after + 1)) {
        return false;
    }
    let bare = strip_marks(&chars[word]);
    !rules
        .exclude_words
        .iter()
        .any(|w| strip_marks(&w.chars().collect::<Vec<_>>()) == bare)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rules() -> KashidaRules {
        KashidaRules {
            exclude_words: vec!["الله".into()],
            never_before: vec!["ا".into()],
            ..Default::default()
        }
    }

    fn chars(s: &str) -> Vec<char> {
        s.chars().collect()
    }

    #[test]
    fn allows_inside_ordinary_word() {
        assert!(rules_allow(&rules(), &chars("بسم"), 0));
    }

    #[test]
    fn refuses_before_alef() {
        // "سلام": kashida between ل and ا refused
        assert!(!rules_allow(&rules(), &chars("سلام"), 1));
    }

    #[test]
    fn refuses_excluded_word_even_with_harakat() {
        assert!(!rules_allow(&rules(), &chars("اللَّه"), 1));
    }

    #[test]
    fn refuses_across_words_and_at_end() {
        assert!(!rules_allow(&rules(), &chars("بسم الله"), 2));
        assert!(!rules_allow(&rules(), &chars("بسم"), 2));
    }

    #[test]
    fn disabled_style_refuses_everything() {
        let r = KashidaRules {
            enabled: false,
            ..Default::default()
        };
        assert!(!rules_allow(&r, &chars("بسم"), 0));
    }
}
