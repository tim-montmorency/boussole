//! Venue bundle validation + media hashing (DATA-2, DATA-4, PLAN-1).
//! Behaviour matches tools/forge.mjs; both gate CI.

use crate::geo::{fit_affine, ControlPoint};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

pub struct Report {
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub max_residual_m: Option<f64>,
}

impl Report {
    pub fn ok(&self) -> bool {
        self.errors.is_empty()
    }
}

fn sha256_file(p: &Path) -> String {
    let bytes = std::fs::read(p).unwrap_or_default();
    format!("sha256:{}", hex(&Sha256::digest(&bytes)))
}

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

fn media_files(dir: &Path) -> Vec<String> {
    let media = dir.join("media");
    if !media.is_dir() {
        return vec![];
    }
    let mut out: Vec<String> = std::fs::read_dir(media)
        .map(|rd| {
            rd.flatten()
                .map(|e| format!("media/{}", e.file_name().to_string_lossy()))
                .collect()
        })
        .unwrap_or_default();
    out.sort();
    out
}

pub fn validate(dir: &Path) -> Report {
    let mut errors = vec![];
    let mut warnings = vec![];
    let manifest = dir.join("venue.json");
    let Ok(text) = std::fs::read_to_string(&manifest) else {
        return Report { errors: vec![format!("{} not found", manifest.display())],
            warnings, max_residual_m: None };
    };
    let bundle: serde_json::Value = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(e) => return Report { errors: vec![format!("venue.json: invalid JSON: {e}")],
            warnings, max_residual_m: None },
    };

    // Minimal structural checks (the full JSON-schema subset lives in the app;
    // forge enforces the authoring-critical invariants)
    for key in ["schema", "id", "name", "lang", "origin", "plan", "reperes"] {
        if bundle.get(key).is_none() {
            errors.push(format!("venue.json: missing required property \"{key}\""));
        }
    }

    // Georeference residuals (PLAN-1)
    let mut max_residual_m = None;
    if let Some(cps) = bundle.pointer("/plan/controlPoints").and_then(|v| v.as_array()) {
        let points: Vec<ControlPoint> = cps
            .iter()
            .filter_map(|c| Some(ControlPoint {
                px: c.get("px")?.as_f64()?,
                py: c.get("py")?.as_f64()?,
                lat: c.get("lat")?.as_f64()?,
                lon: c.get("lon")?.as_f64()?,
            }))
            .collect();
        match fit_affine(&points) {
            Ok((_, _, res)) => {
                max_residual_m = Some(res);
                if res > 5.0 {
                    warnings.push(format!("georeference residual {res:.2} m > 5 m — check control points"));
                }
            }
            Err(e) => errors.push(format!("georeference: {e}")),
        }
    }

    // Media hashes (DATA-2)
    if let Some(media) = bundle.get("media").and_then(|m| m.as_object()) {
        for (path, want) in media {
            let p = dir.join(path);
            if !p.exists() {
                errors.push(format!("media missing: {path}"));
                continue;
            }
            let got = sha256_file(&p);
            if got != want.as_str().unwrap_or("") {
                errors.push(format!("media hash mismatch: {path}"));
            }
        }
    }
    for f in media_files(dir) {
        let declared = bundle.get("media").and_then(|m| m.get(&f)).is_some();
        if !declared {
            warnings.push(format!("media not hashed in manifest: {f}"));
        }
    }

    Report { errors, warnings, max_residual_m }
}

/// Write sha256 hashes for all media/ files into venue.json (in place).
pub fn hash(dir: &Path) -> Result<usize, String> {
    let manifest = dir.join("venue.json");
    let mut bundle: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(&manifest).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    let files = media_files(dir);
    let map: serde_json::Map<String, serde_json::Value> = files
        .iter()
        .map(|f| (f.clone(), serde_json::Value::String(sha256_file(&dir.join(f)))))
        .collect();
    bundle["media"] = serde_json::Value::Object(map);
    std::fs::write(&manifest, serde_json::to_string_pretty(&bundle).unwrap() + "\n")
        .map_err(|e| e.to_string())?;
    Ok(files.len())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn example() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../venues/example")
    }

    #[test]
    fn example_bundle_validates_clean() {
        let r = validate(&example());
        assert!(r.errors.is_empty(), "errors: {:?}", r.errors);
        assert!(r.max_residual_m.unwrap() < 0.01);
    }

    #[test]
    fn missing_manifest_errors() {
        let r = validate(Path::new("/nonexistent"));
        assert!(!r.ok());
    }

    #[test]
    fn hash_round_trip_then_validate() {
        let tmp = std::env::temp_dir().join("forge-test-hash");
        std::fs::create_dir_all(tmp.join("media")).unwrap();
        std::fs::copy(example().join("venue.json"), tmp.join("venue.json")).unwrap();
        std::fs::write(tmp.join("media/x.opus"), b"test-bytes").unwrap();
        let n = hash(&tmp).unwrap();
        assert!(n >= 1);
        let r = validate(&tmp);
        assert!(r.errors.is_empty(), "errors: {:?}", r.errors);
        std::fs::remove_dir_all(&tmp).ok();
    }
}
