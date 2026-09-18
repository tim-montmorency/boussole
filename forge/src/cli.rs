use clap::{Parser, Subcommand};
use std::path::PathBuf;

/// boussole-forge — venue bundle authoring CLI.
/// Reference behaviour matches tools/forge.mjs (the Node reference impl).
#[derive(Parser)]
#[command(name = "boussole-forge", version, about)]
pub struct Cli {
    #[command(subcommand)]
    pub cmd: Cmd,
}

#[derive(Subcommand)]
pub enum Cmd {
    /// Validate a venue bundle: schema, media hashes, georeference residuals.
    Validate { dir: PathBuf },
    /// Write sha256 hashes for media/ files into venue.json.
    Hash { dir: PathBuf },
    /// Emit a printable QR sheet (HTML — print to PDF from any browser).
    QrSheet { dir: PathBuf, #[arg(long, default_value = "qrs.html")] out: PathBuf },
    /// Scaffold a new venue bundle directory.
    Init {
        dir: PathBuf,
        #[arg(long)] id: String,
        #[arg(long)] name: String,
        #[arg(long)] lat: f64,
        #[arg(long)] lon: f64,
    },
    /// Slice an oversized plan (>4096 px) into a 2-level tile pyramid (PLAN-4).
    Slice { dir: PathBuf },
}
