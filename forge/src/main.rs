mod cli;
mod geo;
mod venue;

use clap::Parser;
use cli::{Cli, Cmd};
use std::process::ExitCode;

fn main() -> ExitCode {
    let cli = Cli::parse();
    match cli.cmd {
        Cmd::Validate { dir } => {
            let r = venue::validate(&dir);
            if let Some(res) = r.max_residual_m {
                println!("  georeference max residual: {res:.2} m");
            }
            for w in &r.warnings {
                println!("⚠ {w}");
            }
            for e in &r.errors {
                eprintln!("✗ {e}");
            }
            if r.ok() {
                println!("✓ bundle valid");
                ExitCode::SUCCESS
            } else {
                eprintln!("✗ {} error(s)", r.errors.len());
                ExitCode::FAILURE
            }
        }
        Cmd::Hash { dir } => match venue::hash(&dir) {
            Ok(n) => {
                println!("✓ wrote {n} media hashes into venue.json");
                ExitCode::SUCCESS
            }
            Err(e) => {
                eprintln!("✗ {e}");
                ExitCode::FAILURE
            }
        },
        Cmd::QrSheet { dir, out } => match qr_sheet(&dir, &out) {
            Ok(n) => {
                println!("✓ {n} QRs → {}", out.display());
                ExitCode::SUCCESS
            }
            Err(e) => {
                eprintln!("✗ {e}");
                ExitCode::FAILURE
            }
        },
    }
}

/// QR sheet: print-ready HTML, one card per ancre with its `?ancre=` URL.
/// Print to PDF from any browser; no PDF library needed.
fn qr_sheet(dir: &std::path::Path, out: &std::path::Path) -> Result<usize, String> {
    let text = std::fs::read_to_string(dir.join("venue.json")).map_err(|e| e.to_string())?;
    let bundle: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let base = bundle.get("url").and_then(|u| u.as_str()).unwrap_or("./app/");
    let mut cards = String::new();
    let mut count = 0;
    if let Some(ancres) = bundle.get("ancres").and_then(|a| a.as_array()) {
        for a in ancres {
            let id = a.get("id").and_then(|i| i.as_str()).unwrap_or("");
            let label = a.get("label").and_then(|l| l.as_str()).unwrap_or(id);
            let url = format!("{base}?ancre={id}");
            let code = qrcode::QrCode::new(url.as_bytes()).map_err(|e| e.to_string())?;
            let size = code.width();
            let mut rects = String::new();
            for y in 0..size {
                for x in 0..size {
                    if code[(x, y)] == qrcode::types::Color::Dark {
                        rects.push_str(&format!(
                            "<rect x=\"{}\" y=\"{}\" width=\"1\" height=\"1\"/>", x, y));
                    }
                }
            }
            cards.push_str(&format!(
                "<div class=\"card\"><h2>{label}</h2>\
                 <svg viewBox=\"0 0 {size} {size}\" class=\"qr\"><g fill=\"#000\">{rects}</g></svg>\
                 <p class=\"url\">{url}</p></div>\n"));
            count += 1;
        }
    }
    let html = format!(
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>boussole QR sheet</title>\
         <style>@media print {{ .card {{ page-break-after: always; }} }} \
         body {{ font-family: sans-serif; }} .card {{ text-align: center; padding: 20mm; }} \
         .qr {{ width: 80mm; height: 80mm; shape-rendering: crispEdges; }} \
         .url {{ font-family: monospace; font-size: 10px; word-break: break-all; }}</style>\
         </head><body>\n{cards}</body></html>\n");
    std::fs::write(out, html).map_err(|e| e.to_string())?;
    Ok(count)
}
