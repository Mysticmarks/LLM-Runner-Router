//! Memory management utilities for the native module

use crate::error::{NativeError, Result};
use napi_derive::napi;
use std::sync::atomic::{AtomicU64, Ordering};

static ALLOCATED_BYTES: AtomicU64 = AtomicU64::new(0);
static PEAK_BYTES: AtomicU64 = AtomicU64::new(0);

/// Memory statistics
#[napi(object)]
pub struct MemoryInfo {
    pub allocated_bytes: u64,
    pub peak_bytes: u64,
    pub available_bytes: u64,
    pub system_total: u64,
    pub fragmentation_ratio: f64,
}

/// Memory management utilities
#[napi]
pub struct MemoryManager;

#[napi]
impl MemoryManager {
    /// Get current memory information
    #[napi]
    pub fn get_memory_info() -> napi::Result<MemoryInfo> {
        let allocated = ALLOCATED_BYTES.load(Ordering::Relaxed);
        let peak = PEAK_BYTES.load(Ordering::Relaxed);
        
        #[cfg(feature = "jemalloc")]
        {
            let jemalloc_allocated = get_jemalloc_stat("stats.allocated").unwrap_or(0);
            let jemalloc_resident = get_jemalloc_stat("stats.resident").unwrap_or(0);
            let jemalloc_mapped = get_jemalloc_stat("stats.mapped").unwrap_or(0);
            
            let fragmentation = if jemalloc_allocated > 0 {
                jemalloc_resident as f64 / jemalloc_allocated as f64
            } else {
                1.0
            };
            
            Ok(MemoryInfo {
                allocated_bytes: jemalloc_allocated,
                peak_bytes: peak.max(jemalloc_allocated),
                available_bytes: get_available_memory().unwrap_or(0),
                system_total: get_system_memory().unwrap_or(0),
                fragmentation_ratio: fragmentation,
            })
        }
        
        #[cfg(not(feature = "jemalloc"))]
        {
            Ok(MemoryInfo {
                allocated_bytes: allocated,
                peak_bytes: peak,
                available_bytes: get_available_memory().unwrap_or(0),
                system_total: get_system_memory().unwrap_or(0),
                fragmentation_ratio: 1.0,
            })
        }
    }

    /// Force garbage collection (if applicable)
    #[napi]
    pub fn force_gc() -> napi::Result<()> {
        #[cfg(feature = "jemalloc")]
        {
            use jemalloc_sys::mallctl;
            
            // Trigger jemalloc garbage collection
            let mut epoch: u64 = 1;
            let epoch_ptr = &mut epoch as *mut u64 as *mut std::ffi::c_void;
            
            unsafe {
                mallctl(
                    b"thread.tcache.flush\0".as_ptr() as *const i8,
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    0,
                );
                
                mallctl(
                    b"arenas.purge\0".as_ptr() as *const i8,
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    0,
                );
            }
        }
        
        Ok(())
    }

    /// Set memory limit (advisory)
    #[napi]
    pub fn set_memory_limit(limit_bytes: u64) -> napi::Result<()> {
        // This is advisory - actual enforcement would require custom allocator integration
        tracing::info!("Memory limit set to {} bytes", limit_bytes);
        Ok(())
    }

    /// Get memory usage by category
    #[napi]
    pub fn get_memory_breakdown() -> napi::Result<MemoryBreakdown> {
        #[cfg(feature = "jemalloc")]
        {
            let allocated = get_jemalloc_stat("stats.allocated").unwrap_or(0);
            let active = get_jemalloc_stat("stats.active").unwrap_or(0);
            let mapped = get_jemalloc_stat("stats.mapped").unwrap_or(0);
            let resident = get_jemalloc_stat("stats.resident").unwrap_or(0);
            let metadata = get_jemalloc_stat("stats.metadata").unwrap_or(0);
            
            Ok(MemoryBreakdown {
                active_bytes: active,
                allocated_bytes: allocated,
                mapped_bytes: mapped,
                resident_bytes: resident,
                metadata_bytes: metadata,
                retained_bytes: mapped.saturating_sub(resident),
            })
        }
        
        #[cfg(not(feature = "jemalloc"))]
        {
            Ok(MemoryBreakdown {
                active_bytes: 0,
                allocated_bytes: ALLOCATED_BYTES.load(Ordering::Relaxed),
                mapped_bytes: 0,
                resident_bytes: 0,
                metadata_bytes: 0,
                retained_bytes: 0,
            })
        }
    }
}

/// Detailed memory breakdown
#[napi(object)]
pub struct MemoryBreakdown {
    pub active_bytes: u64,
    pub allocated_bytes: u64,
    pub mapped_bytes: u64,
    pub resident_bytes: u64,
    pub metadata_bytes: u64,
    pub retained_bytes: u64,
}

/// Track memory allocation
pub fn track_allocation(size: usize) {
    let new_allocated = ALLOCATED_BYTES.fetch_add(size as u64, Ordering::Relaxed) + size as u64;
    
    // Update peak if necessary
    let mut current_peak = PEAK_BYTES.load(Ordering::Relaxed);
    while new_allocated > current_peak {
        match PEAK_BYTES.compare_exchange_weak(
            current_peak,
            new_allocated,
            Ordering::Relaxed,
            Ordering::Relaxed,
        ) {
            Ok(_) => break,
            Err(actual) => current_peak = actual,
        }
    }
}

/// Track memory deallocation
pub fn track_deallocation(size: usize) {
    ALLOCATED_BYTES.fetch_sub(size as u64, Ordering::Relaxed);
}

/// Get jemalloc statistics
#[cfg(feature = "jemalloc")]
pub fn get_jemalloc_stat(name: &str) -> Result<u64> {
    use jemalloc_sys::{mallctl, mallctlnametomib};
    use std::ffi::CString;
    use std::mem;
    
    let name_c = CString::new(name)
        .map_err(|e| NativeError::memory(format!("Invalid stat name: {}", e)))?;
    
    let mut value: u64 = 0;
    let mut value_len = mem::size_of::<u64>();
    
    let result = unsafe {
        mallctl(
            name_c.as_ptr(),
            &mut value as *mut u64 as *mut std::ffi::c_void,
            &mut value_len,
            std::ptr::null_mut(),
            0,
        )
    };
    
    if result == 0 {
        Ok(value)
    } else {
        Err(NativeError::memory(format!("Failed to get jemalloc stat: {}", name)))
    }
}

/// Get available system memory
fn get_available_memory() -> Result<u64> {
    #[cfg(target_os = "linux")]
    {
        use std::fs;
        let meminfo = fs::read_to_string("/proc/meminfo")
            .map_err(|e| NativeError::memory(format!("Failed to read /proc/meminfo: {}", e)))?;
        
        for line in meminfo.lines() {
            if line.starts_with("MemAvailable:") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let kb = parts[1].parse::<u64>()
                        .map_err(|e| NativeError::memory(format!("Failed to parse memory value: {}", e)))?;
                    return Ok(kb * 1024); // Convert KB to bytes
                }
            }
        }
        
        Err(NativeError::memory("MemAvailable not found in /proc/meminfo"))
    }
    
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        
        let output = Command::new("vm_stat")
            .output()
            .map_err(|e| NativeError::memory(format!("Failed to run vm_stat: {}", e)))?;
        
        let output_str = String::from_utf8(output.stdout)
            .map_err(|e| NativeError::memory(format!("Invalid vm_stat output: {}", e)))?;
        
        // Parse vm_stat output (simplified)
        // This is a basic implementation - a full implementation would parse all fields
        Ok(0) // Placeholder
    }
    
    #[cfg(target_os = "windows")]
    {
        // Would use Windows API here
        Ok(0) // Placeholder
    }
    
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        Ok(0) // Unsupported platform
    }
}

/// Get total system memory
fn get_system_memory() -> Result<u64> {
    #[cfg(target_os = "linux")]
    {
        use std::fs;
        let meminfo = fs::read_to_string("/proc/meminfo")
            .map_err(|e| NativeError::memory(format!("Failed to read /proc/meminfo: {}", e)))?;
        
        for line in meminfo.lines() {
            if line.starts_with("MemTotal:") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let kb = parts[1].parse::<u64>()
                        .map_err(|e| NativeError::memory(format!("Failed to parse memory value: {}", e)))?;
                    return Ok(kb * 1024); // Convert KB to bytes
                }
            }
        }
        
        Err(NativeError::memory("MemTotal not found in /proc/meminfo"))
    }
    
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        
        let output = Command::new("sysctl")
            .args(&["-n", "hw.memsize"])
            .output()
            .map_err(|e| NativeError::memory(format!("Failed to run sysctl: {}", e)))?;
        
        let output_str = String::from_utf8(output.stdout)
            .map_err(|e| NativeError::memory(format!("Invalid sysctl output: {}", e)))?;
        
        let bytes = output_str.trim().parse::<u64>()
            .map_err(|e| NativeError::memory(format!("Failed to parse memory size: {}", e)))?;
        
        Ok(bytes)
    }
    
    #[cfg(target_os = "windows")]
    {
        // Would use Windows API here
        Ok(0) // Placeholder
    }
    
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        Ok(0) // Unsupported platform
    }
}

/// Memory pool for efficient allocation
pub struct MemoryPool {
    blocks: Vec<Vec<u8>>,
    block_size: usize,
    used_blocks: Vec<bool>,
}

impl MemoryPool {
    /// Create a new memory pool
    pub fn new(block_size: usize, initial_blocks: usize) -> Self {
        let mut blocks = Vec::with_capacity(initial_blocks);
        let mut used_blocks = Vec::with_capacity(initial_blocks);
        
        for _ in 0..initial_blocks {
            blocks.push(vec![0u8; block_size]);
            used_blocks.push(false);
        }
        
        track_allocation(block_size * initial_blocks);
        
        MemoryPool {
            blocks,
            block_size,
            used_blocks,
        }
    }
    
    /// Allocate a block from the pool
    pub fn allocate(&mut self) -> Option<usize> {
        for (index, &used) in self.used_blocks.iter().enumerate() {
            if !used {
                self.used_blocks[index] = true;
                return Some(index);
            }
        }
        
        // No free blocks, allocate a new one
        let index = self.blocks.len();
        self.blocks.push(vec![0u8; self.block_size]);
        self.used_blocks.push(true);
        track_allocation(self.block_size);
        
        Some(index)
    }
    
    /// Deallocate a block back to the pool
    pub fn deallocate(&mut self, index: usize) {
        if index < self.used_blocks.len() {
            self.used_blocks[index] = false;
        }
    }
    
    /// Get block data
    pub fn get_block(&self, index: usize) -> Option<&[u8]> {
        self.blocks.get(index).map(|v| v.as_slice())
    }
    
    /// Get mutable block data
    pub fn get_block_mut(&mut self, index: usize) -> Option<&mut [u8]> {
        self.blocks.get_mut(index).map(|v| v.as_mut_slice())
    }
}

impl Drop for MemoryPool {
    fn drop(&mut self) {
        let total_size = self.blocks.len() * self.block_size;
        track_deallocation(total_size);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_memory_tracking() {
        let initial = ALLOCATED_BYTES.load(Ordering::Relaxed);
        
        track_allocation(1024);
        assert_eq!(ALLOCATED_BYTES.load(Ordering::Relaxed), initial + 1024);
        
        track_deallocation(512);
        assert_eq!(ALLOCATED_BYTES.load(Ordering::Relaxed), initial + 512);
    }
    
    #[test]
    fn test_memory_pool() {
        let mut pool = MemoryPool::new(1024, 2);
        
        let block1 = pool.allocate().unwrap();
        let block2 = pool.allocate().unwrap();
        
        assert_eq!(block1, 0);
        assert_eq!(block2, 1);
        
        pool.deallocate(block1);
        let block3 = pool.allocate().unwrap();
        assert_eq!(block3, 0); // Reused block1
    }
    
    #[test]
    fn test_memory_info() {
        let info = MemoryManager::get_memory_info().unwrap();
        assert!(info.allocated_bytes >= 0);
        assert!(info.peak_bytes >= info.allocated_bytes);
    }
}