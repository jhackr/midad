//! Undo / redo by document snapshots.
//!
//! Documents are small (text + a few overrides), so whole snapshots are
//! simpler and safer than inverse operations. A *gesture* (e.g. dragging a
//! letter with the mouse) groups many edits into one undo step.

use std::collections::VecDeque;

use crate::document::Document;

#[derive(Debug, Clone)]
pub struct History {
    undo: VecDeque<Document>,
    redo: Vec<Document>,
    limit: usize,
    /// `Some(recorded)` while a gesture is open.
    gesture: Option<bool>,
}

impl Default for History {
    fn default() -> Self {
        Self::new(200)
    }
}

impl History {
    pub fn new(limit: usize) -> Self {
        Self {
            undo: VecDeque::new(),
            redo: Vec::new(),
            limit: limit.max(1),
            gesture: None,
        }
    }

    /// Remember `before` as the state to return to. Call before mutating.
    pub fn record(&mut self, before: &Document) {
        if let Some(recorded) = &mut self.gesture {
            if *recorded {
                return;
            }
            *recorded = true;
        }
        self.undo.push_back(before.clone());
        if self.undo.len() > self.limit {
            self.undo.pop_front();
        }
        self.redo.clear();
    }

    pub fn begin_gesture(&mut self) {
        self.gesture = Some(false);
    }

    pub fn end_gesture(&mut self) {
        self.gesture = None;
    }

    pub fn undo(&mut self, current: &mut Document) -> bool {
        self.gesture = None;
        match self.undo.pop_back() {
            Some(previous) => {
                self.redo.push(std::mem::replace(current, previous));
                true
            }
            None => false,
        }
    }

    pub fn redo(&mut self, current: &mut Document) -> bool {
        self.gesture = None;
        match self.redo.pop() {
            Some(next) => {
                self.undo.push_back(std::mem::replace(current, next));
                true
            }
            None => false,
        }
    }

    pub fn can_undo(&self) -> bool {
        !self.undo.is_empty()
    }

    pub fn can_redo(&self) -> bool {
        !self.redo.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::document::StyleRef;

    fn doc(t: &str) -> Document {
        Document::new(
            StyleRef {
                id: "s".into(),
                version: "1".into(),
            },
            t,
        )
    }

    #[test]
    fn undo_redo_roundtrip() {
        let mut h = History::default();
        let mut d = doc("a");
        h.record(&d);
        d.set_text("ab");
        assert!(h.undo(&mut d));
        assert_eq!(d.text, "a");
        assert!(h.redo(&mut d));
        assert_eq!(d.text, "ab");
    }

    #[test]
    fn gesture_is_one_step() {
        let mut h = History::default();
        let mut d = doc("a");
        h.begin_gesture();
        for t in ["ab", "abc", "abcd"] {
            h.record(&d);
            d.set_text(t);
        }
        h.end_gesture();
        assert!(h.undo(&mut d));
        assert_eq!(d.text, "a");
        assert!(!h.can_undo());
    }

    #[test]
    fn new_edit_clears_redo() {
        let mut h = History::default();
        let mut d = doc("a");
        h.record(&d);
        d.set_text("b");
        h.undo(&mut d);
        h.record(&d);
        d.set_text("c");
        assert!(!h.can_redo());
    }
}
