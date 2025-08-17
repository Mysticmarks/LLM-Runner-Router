use napi_build;
use std::env;

fn main() {
    // Setup N-API build
    napi_build::setup();
    
    // Get build information
    let target = env::var("TARGET").unwrap();
    let profile = env::var("PROFILE").unwrap();
    
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=src/");
    
    // Configure based on target platform
    if target.contains("windows") {
        // Windows-specific configuration
        println!("cargo:rustc-link-lib=advapi32");
        println!("cargo:rustc-link-lib=user32");
    } else if target.contains("apple") {
        // macOS-specific configuration
        println!("cargo:rustc-link-lib=framework=Foundation");
        println!("cargo:rustc-link-lib=framework=Security");
    } else if target.contains("linux") {
        // Linux-specific configuration
        println!("cargo:rustc-link-lib=dl");
        println!("cargo:rustc-link-lib=pthread");
    }
    
    // Enable SIMD optimizations for release builds
    if profile == "release" {
        if target.contains("x86_64") {
            println!("cargo:rustc-cfg=simd_x86");
        } else if target.contains("aarch64") {
            println!("cargo:rustc-cfg=simd_arm");
        }
    }
    
    // Configure jemalloc if enabled
    #[cfg(feature = "jemalloc")]
    {
        // Set jemalloc configuration for optimal performance
        println!("cargo:rustc-env=MALLOC_CONF=prof:true,lg_prof_interval:30,lg_prof_sample:19");
    }
    
    // Generate build information
    println!("cargo:rustc-env=BUILD_TARGET={}", target);
    println!("cargo:rustc-env=BUILD_PROFILE={}", profile);
    
    // Determine SIMD capabilities at build time
    let simd_level = if target.contains("x86_64") {
        "x86_64"
    } else if target.contains("aarch64") {
        "aarch64"
    } else {
        "baseline"
    };
    
    println!("cargo:rustc-env=SIMD_LEVEL={}", simd_level);
    
    // Set optimization flags for release builds
    if profile == "release" {
        println!("cargo:rustc-env=RUSTFLAGS=-C target-cpu=native");
    }
}