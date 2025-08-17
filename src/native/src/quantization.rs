//! Model quantization utilities for reducing memory usage and improving inference speed

use crate::{error::{NativeError, Result}, perf::Timer};
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use candle_core::{Tensor, Device, DType};
use std::collections::HashMap;
use half::f16;

/// Quantization type enumeration
#[napi]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum QuantizationType {
    /// No quantization (FP32)
    None,
    /// Half precision (FP16)
    FP16,
    /// 8-bit integer quantization
    INT8,
    /// 4-bit integer quantization
    INT4,
    /// Dynamic quantization
    Dynamic,
}

/// Quantization configuration
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuantizationConfig {
    /// Type of quantization to apply
    pub quantization_type: QuantizationType,
    /// Calibration dataset size for INT8/INT4
    pub calibration_size: Option<u32>,
    /// Whether to quantize weights only
    pub weights_only: Option<bool>,
    /// Quantization scheme (symmetric/asymmetric)
    pub symmetric: Option<bool>,
    /// Per-channel quantization
    pub per_channel: Option<bool>,
    /// Quantization range clipping
    pub clip_range: Option<Vec<f32>>,
}

impl Default for QuantizationConfig {
    fn default() -> Self {
        Self {
            quantization_type: QuantizationType::FP16,
            calibration_size: Some(512),
            weights_only: Some(true),
            symmetric: Some(true),
            per_channel: Some(false),
            clip_range: None,
        }
    }
}

/// Quantized model representation
#[napi]
pub struct QuantizedModel {
    weights: HashMap<String, QuantizedTensor>,
    config: QuantizationConfig,
    original_size: u64,
    quantized_size: u64,
    device: Device,
}

/// Quantized tensor with metadata
#[derive(Debug, Clone)]
pub struct QuantizedTensor {
    pub data: Tensor,
    pub scale: Option<Tensor>,
    pub zero_point: Option<Tensor>,
    pub original_dtype: DType,
    pub quantized_dtype: DType,
}

/// Quantization statistics
#[napi(object)]
pub struct QuantizationStats {
    pub original_size_mb: f64,
    pub quantized_size_mb: f64,
    pub compression_ratio: f64,
    pub memory_saved_mb: f64,
    pub quantization_time_ms: f64,
}

#[napi]
impl QuantizedModel {
    /// Create a new quantized model
    #[napi(constructor)]
    pub fn new(config: QuantizationConfig) -> napi::Result<QuantizedModel> {
        let device = Device::Cpu; // Default to CPU, can be extended for GPU
        
        Ok(QuantizedModel {
            weights: HashMap::new(),
            config,
            original_size: 0,
            quantized_size: 0,
            device,
        })
    }

    /// Quantize a tensor according to the configuration
    #[napi]
    pub async fn quantize_tensor(&mut self, name: String, data: Vec<f32>, shape: Vec<u32>) -> napi::Result<()> {
        let _timer = Timer::new(&format!("quantize_tensor_{}", name));
        
        // Convert shape to usize
        let shape: Vec<usize> = shape.iter().map(|&x| x as usize).collect();
        
        // Create tensor from data
        let tensor = Tensor::from_vec(data, &shape, &self.device)
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        
        // Perform quantization based on type
        let quantized = match self.config.quantization_type {
            QuantizationType::None => self.quantize_none(tensor)?,
            QuantizationType::FP16 => self.quantize_fp16(tensor)?,
            QuantizationType::INT8 => self.quantize_int8(tensor)?,
            QuantizationType::INT4 => self.quantize_int4(tensor)?,
            QuantizationType::Dynamic => self.quantize_dynamic(tensor)?,
        };
        
        // Calculate sizes
        let original_size = tensor.elem_count() * tensor.dtype().size_in_bytes();
        let quantized_size = quantized.data.elem_count() * quantized.data.dtype().size_in_bytes();
        
        self.original_size += original_size as u64;
        self.quantized_size += quantized_size as u64;
        
        // Store quantized tensor
        self.weights.insert(name, quantized);
        
        Ok(())
    }

    /// Get quantization statistics
    #[napi]
    pub fn get_stats(&self) -> QuantizationStats {
        let original_mb = self.original_size as f64 / (1024.0 * 1024.0);
        let quantized_mb = self.quantized_size as f64 / (1024.0 * 1024.0);
        let compression_ratio = if self.quantized_size > 0 {
            self.original_size as f64 / self.quantized_size as f64
        } else {
            1.0
        };
        
        QuantizationStats {
            original_size_mb: original_mb,
            quantized_size_mb: quantized_mb,
            compression_ratio,
            memory_saved_mb: original_mb - quantized_mb,
            quantization_time_ms: 0.0, // Would need to track this separately
        }
    }

    /// Get quantized tensor by name
    #[napi]
    pub async fn get_tensor(&self, name: String) -> napi::Result<Vec<f32>> {
        let quantized_tensor = self.weights.get(&name)
            .ok_or_else(|| NativeError::invalid_input(format!("Tensor '{}' not found", name)))?;
        
        // Dequantize tensor for output
        let dequantized = self.dequantize_tensor(quantized_tensor)?;
        
        // Convert to Vec<f32>
        let data = dequantized.flatten_all()
            .map_err(|e| NativeError::tensor_op(e.to_string()))?
            .to_vec1::<f32>()
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        
        Ok(data)
    }

    /// List all tensor names
    #[napi]
    pub fn list_tensors(&self) -> Vec<String> {
        self.weights.keys().cloned().collect()
    }

    /// No quantization (passthrough)
    fn quantize_none(&self, tensor: Tensor) -> Result<QuantizedTensor> {
        Ok(QuantizedTensor {
            data: tensor.clone(),
            scale: None,
            zero_point: None,
            original_dtype: tensor.dtype(),
            quantized_dtype: tensor.dtype(),
        })
    }

    /// FP16 quantization
    fn quantize_fp16(&self, tensor: Tensor) -> Result<QuantizedTensor> {
        let fp16_tensor = tensor.to_dtype(DType::F16)
            .map_err(|e| NativeError::quantization(e.to_string()))?;
        
        Ok(QuantizedTensor {
            data: fp16_tensor,
            scale: None,
            zero_point: None,
            original_dtype: tensor.dtype(),
            quantized_dtype: DType::F16,
        })
    }

    /// INT8 quantization with scale and zero point
    fn quantize_int8(&self, tensor: Tensor) -> Result<QuantizedTensor> {
        // Calculate min and max values
        let min_val = tensor.min(tensor.dims().len() - 1)
            .map_err(|e| NativeError::quantization(e.to_string()))?;
        let max_val = tensor.max(tensor.dims().len() - 1)
            .map_err(|e| NativeError::quantization(e.to_string()))?;
        
        // Calculate scale and zero point
        let qmin = -128.0_f32;
        let qmax = 127.0_f32;
        
        let scale = (&max_val - &min_val)? / (qmax - qmin);
        let zero_point = qmin - min_val.div(&scale)?;
        
        // Quantize the tensor
        let quantized = tensor.div(&scale)?
            .add(&zero_point)?
            .round()?
            .clamp(qmin as f64, qmax as f64)?
            .to_dtype(DType::I64)?; // Using I64 as INT8 placeholder
        
        Ok(QuantizedTensor {
            data: quantized,
            scale: Some(scale),
            zero_point: Some(zero_point),
            original_dtype: tensor.dtype(),
            quantized_dtype: DType::I64,
        })
    }

    /// INT4 quantization (simplified implementation)
    fn quantize_int4(&self, tensor: Tensor) -> Result<QuantizedTensor> {
        // For INT4, we'll use a similar approach to INT8 but with smaller range
        let min_val = tensor.min(tensor.dims().len() - 1)
            .map_err(|e| NativeError::quantization(e.to_string()))?;
        let max_val = tensor.max(tensor.dims().len() - 1)
            .map_err(|e| NativeError::quantization(e.to_string()))?;
        
        let qmin = -8.0_f32;
        let qmax = 7.0_f32;
        
        let scale = (&max_val - &min_val)? / (qmax - qmin);
        let zero_point = qmin - min_val.div(&scale)?;
        
        let quantized = tensor.div(&scale)?
            .add(&zero_point)?
            .round()?
            .clamp(qmin as f64, qmax as f64)?
            .to_dtype(DType::I64)?; // Using I64 as INT4 placeholder
        
        Ok(QuantizedTensor {
            data: quantized,
            scale: Some(scale),
            zero_point: Some(zero_point),
            original_dtype: tensor.dtype(),
            quantized_dtype: DType::I64,
        })
    }

    /// Dynamic quantization (weights only)
    fn quantize_dynamic(&self, tensor: Tensor) -> Result<QuantizedTensor> {
        // Choose quantization type based on tensor properties
        let elem_count = tensor.elem_count();
        
        if elem_count > 1_000_000 {
            // Large tensors: use INT8
            self.quantize_int8(tensor)
        } else if elem_count > 10_000 {
            // Medium tensors: use FP16
            self.quantize_fp16(tensor)
        } else {
            // Small tensors: no quantization
            self.quantize_none(tensor)
        }
    }

    /// Dequantize a tensor back to original precision
    fn dequantize_tensor(&self, quantized: &QuantizedTensor) -> Result<Tensor> {
        match quantized.quantized_dtype {
            DType::F16 => {
                // Convert FP16 back to FP32
                quantized.data.to_dtype(DType::F32)
                    .map_err(|e| NativeError::quantization(e.to_string()))
            }
            DType::I64 => {
                // Dequantize INT8/INT4
                if let (Some(scale), Some(zero_point)) = (&quantized.scale, &quantized.zero_point) {
                    let dequantized = quantized.data.to_dtype(DType::F32)?
                        .sub(zero_point)?
                        .mul(scale)?;
                    Ok(dequantized)
                } else {
                    Err(NativeError::quantization("Missing scale or zero_point for INT quantization"))
                }
            }
            _ => {
                // No quantization or unknown type
                Ok(quantized.data.clone())
            }
        }
    }
}

/// Utility functions for quantization
pub mod utils {
    use super::*;
    
    /// Calculate optimal quantization parameters
    pub fn calculate_quantization_params(
        tensor: &Tensor,
        qtype: QuantizationType,
        symmetric: bool,
    ) -> Result<(f32, f32)> {
        let min_val = tensor.min(tensor.dims().len() - 1)?
            .to_scalar::<f32>()
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        let max_val = tensor.max(tensor.dims().len() - 1)?
            .to_scalar::<f32>()
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        
        let (qmin, qmax) = match qtype {
            QuantizationType::INT8 => (-128.0, 127.0),
            QuantizationType::INT4 => (-8.0, 7.0),
            _ => return Err(NativeError::quantization("Unsupported quantization type for parameter calculation")),
        };
        
        if symmetric {
            let abs_max = min_val.abs().max(max_val.abs());
            let scale = abs_max / qmax;
            (scale, 0.0)
        } else {
            let scale = (max_val - min_val) / (qmax - qmin);
            let zero_point = qmin - min_val / scale;
            (scale, zero_point)
        }
    }
    
    /// Estimate memory savings from quantization
    pub fn estimate_memory_savings(
        original_dtype: DType,
        target_qtype: QuantizationType,
        elem_count: usize,
    ) -> (usize, usize, f32) {
        let original_size = elem_count * original_dtype.size_in_bytes();
        
        let target_size = match target_qtype {
            QuantizationType::None => original_size,
            QuantizationType::FP16 => elem_count * 2,
            QuantizationType::INT8 => elem_count * 1,
            QuantizationType::INT4 => elem_count / 2, // Packed
            QuantizationType::Dynamic => elem_count * 2, // Assume FP16 average
        };
        
        let compression_ratio = original_size as f32 / target_size as f32;
        
        (original_size, target_size, compression_ratio)
    }
}

/// Benchmark quantization performance
#[napi]
pub async fn benchmark_quantization(
    data: Vec<f32>,
    shape: Vec<u32>,
    qtype: QuantizationType,
    iterations: u32,
) -> napi::Result<f64> {
    let _timer = Timer::new("quantization_benchmark");
    
    let mut model = QuantizedModel::new(QuantizationConfig {
        quantization_type: qtype,
        ..Default::default()
    })?;
    
    let start = std::time::Instant::now();
    
    for i in 0..iterations {
        let tensor_name = format!("tensor_{}", i);
        model.quantize_tensor(tensor_name, data.clone(), shape.clone()).await?;
    }
    
    let duration = start.elapsed();
    let ops_per_sec = iterations as f64 / duration.as_secs_f64();
    
    Ok(ops_per_sec)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_quantized_model_creation() {
        let config = QuantizationConfig::default();
        let model = QuantizedModel::new(config);
        assert!(model.is_ok());
    }
    
    #[tokio::test]
    async fn test_fp16_quantization() {
        let mut model = QuantizedModel::new(QuantizationConfig {
            quantization_type: QuantizationType::FP16,
            ..Default::default()
        }).unwrap();
        
        let data = vec![1.0, 2.0, 3.0, 4.0];
        let shape = vec![2, 2];
        
        let result = model.quantize_tensor("test".to_string(), data, shape).await;
        assert!(result.is_ok());
        
        let stats = model.get_stats();
        assert!(stats.compression_ratio > 1.0);
    }
    
    #[tokio::test]
    async fn test_int8_quantization() {
        let mut model = QuantizedModel::new(QuantizationConfig {
            quantization_type: QuantizationType::INT8,
            ..Default::default()
        }).unwrap();
        
        let data = (0..100).map(|i| i as f32 / 10.0).collect();
        let shape = vec![10, 10];
        
        let result = model.quantize_tensor("test".to_string(), data, shape).await;
        assert!(result.is_ok());
        
        // Test retrieval
        let retrieved = model.get_tensor("test".to_string()).await;
        assert!(retrieved.is_ok());
        assert_eq!(retrieved.unwrap().len(), 100);
    }
    
    #[test]
    fn test_memory_estimation() {
        let (original, quantized, ratio) = utils::estimate_memory_savings(
            DType::F32,
            QuantizationType::INT8,
            1000,
        );
        
        assert_eq!(original, 4000); // 1000 * 4 bytes
        assert_eq!(quantized, 1000); // 1000 * 1 byte
        assert_eq!(ratio, 4.0);
    }
}