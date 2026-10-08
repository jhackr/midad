//! Tiny 2D geometry helpers. All coordinates are font units, y pointing up.

use serde::{Deserialize, Serialize};

/// Axis-aligned rectangle `[x0, y0] – [x1, y1]`.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Rect {
    pub x0: f32,
    pub y0: f32,
    pub x1: f32,
    pub y1: f32,
}

impl Rect {
    pub const fn new(x0: f32, y0: f32, x1: f32, y1: f32) -> Self {
        Self { x0, y0, x1, y1 }
    }

    pub fn width(&self) -> f32 {
        self.x1 - self.x0
    }

    pub fn height(&self) -> f32 {
        self.y1 - self.y0
    }

    pub fn center(&self) -> (f32, f32) {
        ((self.x0 + self.x1) * 0.5, (self.y0 + self.y1) * 0.5)
    }

    pub fn union(&self, other: &Rect) -> Rect {
        Rect::new(
            self.x0.min(other.x0),
            self.y0.min(other.y0),
            self.x1.max(other.x1),
            self.y1.max(other.y1),
        )
    }

    pub fn include_point(&mut self, x: f32, y: f32) {
        self.x0 = self.x0.min(x);
        self.y0 = self.y0.min(y);
        self.x1 = self.x1.max(x);
        self.y1 = self.y1.max(y);
    }

    /// Bounding box of this rectangle after applying `m`.
    pub fn transform(&self, m: &Affine) -> Rect {
        let corners = [
            m.apply(self.x0, self.y0),
            m.apply(self.x1, self.y0),
            m.apply(self.x0, self.y1),
            m.apply(self.x1, self.y1),
        ];
        let mut r = Rect::new(corners[0].0, corners[0].1, corners[0].0, corners[0].1);
        for (x, y) in &corners[1..] {
            r.include_point(*x, *y);
        }
        r
    }
}

/// 2D affine transform in SVG `matrix(a b c d e f)` order:
/// `x' = a·x + c·y + e`, `y' = b·x + d·y + f`.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Affine(pub [f32; 6]);

impl Affine {
    pub const IDENTITY: Affine = Affine([1.0, 0.0, 0.0, 1.0, 0.0, 0.0]);

    pub fn translate(x: f32, y: f32) -> Self {
        Affine([1.0, 0.0, 0.0, 1.0, x, y])
    }

    pub fn scale(sx: f32, sy: f32) -> Self {
        Affine([sx, 0.0, 0.0, sy, 0.0, 0.0])
    }

    pub fn rotate_degrees(deg: f32) -> Self {
        let (s, c) = deg.to_radians().sin_cos();
        Affine([c, s, -s, c, 0.0, 0.0])
    }

    /// `self ∘ other`: apply `other` first, then `self`.
    pub fn then(&self, other: &Affine) -> Affine {
        let [a1, b1, c1, d1, e1, f1] = self.0;
        let [a2, b2, c2, d2, e2, f2] = other.0;
        Affine([
            a1 * a2 + c1 * b2,
            b1 * a2 + d1 * b2,
            a1 * c2 + c1 * d2,
            b1 * c2 + d1 * d2,
            a1 * e2 + c1 * f2 + e1,
            b1 * e2 + d1 * f2 + f1,
        ])
    }

    /// Transform around a pivot point: `T(p) · inner · T(-p)`.
    pub fn around(inner: Affine, px: f32, py: f32) -> Affine {
        Affine::translate(px, py)
            .then(&inner)
            .then(&Affine::translate(-px, -py))
    }

    pub fn apply(&self, x: f32, y: f32) -> (f32, f32) {
        let [a, b, c, d, e, f] = self.0;
        (a * x + c * y + e, b * x + d * y + f)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn composition_order() {
        let t = Affine::translate(10.0, 0.0).then(&Affine::scale(2.0, 2.0));
        assert_eq!(t.apply(1.0, 1.0), (12.0, 2.0));
    }

    #[test]
    fn scale_around_pivot_keeps_pivot() {
        let m = Affine::around(Affine::scale(3.0, 3.0), 5.0, 5.0);
        assert_eq!(m.apply(5.0, 5.0), (5.0, 5.0));
    }
}
