//! forge slice — PLAN-4: plans larger than 4096 px are cut into a 2-level
//! pyramid (full-size level 0 + half-size level 1) of 1024 px tiles under
//! `plan.tiles/`, and venue.json is switched to the tiled form.

use image::{DynamicImage, GenericImageView, ImageReader};
use serde_json::{json, Value};
use std::path::Path;

const MAX_SIDE: u32 = 4096;
const TILE: u32 = 1024;

/// Slice `<dir>/<plan.src>` if its longest side exceeds 4096 px.
/// Returns the number of tiles written (0 = no slicing needed).
pub fn slice(dir: &Path) -> Result<usize, String> {
    let manifest = dir.join("venue.json");
    let mut bundle: Value = serde_json::from_str(
        &std::fs::read_to_string(&manifest).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    let src = bundle
        .pointer("/plan/src")
        .and_then(|v| v.as_str())
        .ok_or("venue.json has no plan.src")?
        .to_string();
    let img_path = dir.join(&src);
    let img: DynamicImage = ImageReader::open(&img_path)
        .map_err(|e| e.to_string())?
        .decode()
        .map_err(|e| e.to_string())?;
    let (w, h) = img.dimensions();
    if w.max(h) <= MAX_SIDE {
        return Ok(0); // PLAN-4: single image is fine
    }
    let tiles_dir = dir.join("plan.tiles");
    std::fs::create_dir_all(&tiles_dir).map_err(|e| e.to_string())?;

    let mut count = 0;
    // two levels: full res (0) and half (1)
    for level in 0..=1u32 {
        let scale = 1f64 / (1u32 << level) as f64;
        let lw = ((w as f64) * scale).round() as u32;
        let lh = ((h as f64) * scale).round() as u32;
        let lvl = if level == 0 { img.clone() } else { img.resize(lw, lh, image::imageops::FilterType::Lanczos3) };
        for ty in (0..lh).step_by(TILE as usize) {
            for tx in (0..lw).step_by(TILE as usize) {
                let tw = TILE.min(lw - tx);
                let th = TILE.min(lh - ty);
                let tile = lvl.crop_imm(tx, ty, tw, th);
                tile.save(tiles_dir.join(format!("z{level}_{tx}_{ty}.webp")))
                    .map_err(|e| e.to_string())?;
                count += 1;
            }
        }
    }
    bundle["plan"]["tiles"] = json!({ "dir": "plan.tiles", "tileSize": TILE, "levels": 2 });
    std::fs::write(&manifest, serde_json::to_string_pretty(&bundle).unwrap() + "\n")
        .map_err(|e| e.to_string())?;
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgb};
    use std::path::PathBuf;

    fn tmp_with_plan(px: u32) -> PathBuf {
        let tmp = std::env::temp_dir().join(format!("forge-slice-{px}"));
        std::fs::remove_dir_all(&tmp).ok();
        std::fs::create_dir_all(&tmp).unwrap();
        let img: ImageBuffer<Rgb<u8>, _> = ImageBuffer::from_pixel(px, px / 2, Rgb([128u8, 64, 32]));
        img.save(tmp.join("plan.png")).unwrap();
        std::fs::write(tmp.join("venue.json"), format!(
            r#"{{"schema":1,"id":"t","name":"t","lang":["fr"],"origin":{{"lat":0,"lon":0}},
               "plan":{{"src":"plan.png","width":{px},"height":{}}},
               "reperes":[]}}"#, px / 2)).unwrap();
        tmp
    }

    #[test]
    fn small_plan_is_untouched() {
        let tmp = tmp_with_plan(2048);
        assert_eq!(slice(&tmp).unwrap(), 0);
        assert!(!tmp.join("plan.tiles").exists());
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn oversized_plan_becomes_a_pyramid() {
        let tmp = tmp_with_plan(5000);
        let n = slice(&tmp).unwrap();
        assert!(n > 0);
        assert!(tmp.join("plan.tiles").is_dir());
        let v: Value = serde_json::from_str(
            &std::fs::read_to_string(tmp.join("venue.json")).unwrap()).unwrap();
        assert_eq!(v["plan"]["tiles"]["tileSize"], 1024);
        assert_eq!(v["plan"]["tiles"]["levels"], 2);
        std::fs::remove_dir_all(&tmp).ok();
    }
}
