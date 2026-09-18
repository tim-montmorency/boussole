//! Affine georeference: exact solve at 3 control points, least squares above.
//! Mirrors app/src/lib/geometry/affine.js (PLAN-1) — residuals in metres.

#[derive(Debug, Clone, Copy)]
pub struct ControlPoint {
    pub px: f64,
    pub py: f64,
    pub lat: f64,
    pub lon: f64,
}

/// Solve 3×3 by Cramer; None if singular.
fn solve3(a: [[f64; 3]; 3], b: [f64; 3]) -> Option<[f64; 3]> {
    let det = |m: [[f64; 3]; 3]| {
        m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
            - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
            + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    };
    let d = det(a);
    if d.abs() < 1e-12 {
        return None;
    }
    let mut out = [0.0; 3];
    for i in 0..3 {
        let mut m = a;
        for r in 0..3 {
            m[r][i] = b[r];
        }
        out[i] = det(m) / d;
    }
    Some(out)
}

/// Fit lat/lon = a·px + b·py + c. Returns (lat_coefs, lon_coefs, max_residual_m).
pub fn fit_affine(cps: &[ControlPoint]) -> Result<([f64; 3], [f64; 3], f64), String> {
    if cps.len() < 3 {
        return Err("need at least 3 control points".into());
    }
    let (mut sxx, mut sxy, mut sx, mut syy, mut sy) = (0.0, 0.0, 0.0, 0.0, 0.0);
    let (mut bl, mut bo) = ([0.0; 3], [0.0; 3]);
    for p in cps {
        sxx += p.px * p.px;
        sxy += p.px * p.py;
        sx += p.px;
        syy += p.py * p.py;
        sy += p.py;
        bl[0] += p.px * p.lat;
        bl[1] += p.py * p.lat;
        bl[2] += p.lat;
        bo[0] += p.px * p.lon;
        bo[1] += p.py * p.lon;
        bo[2] += p.lon;
    }
    let n = cps.len() as f64;
    let a = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]];
    let lat_c = solve3(a, bl).ok_or("control points are collinear")?;
    let lon_c = solve3(a, bo).ok_or("control points are collinear")?;
    let max_res_m = cps
        .iter()
        .map(|p| {
            let dlat = lat_c[0] * p.px + lat_c[1] * p.py + lat_c[2] - p.lat;
            let dlon = lon_c[0] * p.px + lon_c[1] * p.py + lon_c[2] - p.lon;
            (dlat.hypot(dlon)) * 111_320.0
        })
        .fold(0.0, f64::max);
    Ok((lat_c, lon_c, max_res_m))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mk(px: f64, py: f64) -> ControlPoint {
        ControlPoint { px, py, lat: 45.5 + py * 1e-5, lon: -73.7 + px * 2e-5 }
    }

    #[test]
    fn exact_solve_at_three_points() {
        let (lat_c, lon_c, res) = fit_affine(&[mk(0.0, 0.0), mk(1000.0, 0.0), mk(0.0, 2000.0)])
            .expect("fits");
        assert!(res < 0.001, "residual {res}");
        assert!((lat_c[0] * 500.0 + lat_c[1] * 700.0 + lat_c[2] - (45.5 + 700.0 * 1e-5)).abs() < 1e-9);
        assert!((lon_c[0] * 500.0 + lon_c[1] * 700.0 + lon_c[2] - (-73.7 + 500.0 * 2e-5)).abs() < 1e-9);
    }

    #[test]
    fn collinear_rejected() {
        assert!(fit_affine(&[mk(0.0, 0.0), mk(500.0, 0.0), mk(1000.0, 0.0)]).is_err());
    }

    #[test]
    fn fewer_than_three_rejected() {
        assert!(fit_affine(&[mk(0.0, 0.0), mk(1.0, 1.0)]).is_err());
    }

    #[test]
    fn noisy_point_is_spread_not_followed() {
        let mut noisy = mk(1000.0, 2000.0);
        noisy.lat += 5e-5;
        let (_, _, res) =
            fit_affine(&[mk(0.0, 0.0), mk(1000.0, 0.0), mk(0.0, 2000.0), noisy]).expect("fits");
        assert!(res > 0.0);
        assert!(res < 5e-5 * 111_320.0, "residual spread, not absorbed");
    }
}
