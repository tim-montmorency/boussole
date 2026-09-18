//! forge init — scaffold a new venue bundle directory (PLAN-1 authoring aid).
//! Non-interactive flags for CI; prompts are a later nicety.

use serde_json::{json, Map, Value};
use std::path::Path;

pub struct InitArgs<'a> {
    pub id: &'a str,
    pub name: &'a str,
    pub lat: f64,
    pub lon: f64,
}

/// Create `<dir>/venue.json` (+ empty media/) for a new venue.
pub fn init(dir: &Path, args: &InitArgs) -> Result<(), String> {
    if dir.join("venue.json").exists() {
        return Err(format!("{} already has a venue.json", dir.display()));
    }
    std::fs::create_dir_all(dir.join("media")).map_err(|e| e.to_string())?;
    let mut defaults = Map::new();
    defaults.insert("captureRadius".into(), json!(4));
    defaults.insert("revealRadius".into(), json!(25));
    defaults.insert("arRange".into(), json!(60));
    defaults.insert("strideLength".into(), json!(0.7));
    defaults.insert("planMode".into(), json!("north-up"));
    defaults.insert("basemap".into(), json!("none"));
    let bundle = json!({
        "schema": 1,
        "id": args.id,
        "name": args.name,
        "licence": "CC-BY-4.0",
        "lang": ["fr", "en"],
        "origin": { "lat": args.lat, "lon": args.lon },
        "plan": {
            "src": "plan.webp",
            "width": 4096,
            "height": 2731,
            "controlPoints": []
        },
        "defaults": Value::Object(defaults),
        "ancres": [],
        "reperes": [],
        "parcours": []
    });
    std::fs::write(
        dir.join("venue.json"),
        serde_json::to_string_pretty(&bundle).unwrap() + "\n",
    )
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scaffolds_a_valid_shaped_bundle() {
        let tmp = std::env::temp_dir().join("forge-test-init");
        std::fs::remove_dir_all(&tmp).ok();
        init(&tmp, &InitArgs { id: "test-v", name: "Test", lat: 45.5, lon: -73.7 }).unwrap();
        let text = std::fs::read_to_string(tmp.join("venue.json")).unwrap();
        let v: Value = serde_json::from_str(&text).unwrap();
        assert_eq!(v["id"], "test-v");
        assert_eq!(v["origin"]["lat"], 45.5);
        assert!(v["plan"]["controlPoints"].as_array().unwrap().is_empty());
        assert!(tmp.join("media").is_dir());
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn refuses_to_overwrite() {
        let tmp = std::env::temp_dir().join("forge-test-init2");
        std::fs::create_dir_all(&tmp).unwrap();
        std::fs::write(tmp.join("venue.json"), "{}").unwrap();
        assert!(init(&tmp, &InitArgs { id: "x", name: "x", lat: 0.0, lon: 0.0 }).is_err());
        std::fs::remove_dir_all(&tmp).ok();
    }
}
