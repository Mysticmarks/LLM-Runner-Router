//! High-performance tensor operations with SIMD optimizations

use crate::{error::{NativeError, Result}, perf::Timer};
use napi_derive::napi;
use candle_core::{Tensor, Device, DType, Shape};
use rayon::prelude::*;

/// Tensor operation utilities
#[napi]
pub struct TensorOps;

#[napi]
impl TensorOps {
    /// Create a new tensor from flat data
    #[napi(factory)]
    pub fn from_data(data: Vec<f32>, shape: Vec<u32>) -> napi::Result<TensorWrapper> {
        let shape: Vec<usize> = shape.iter().map(|&x| x as usize).collect();
        let device = Device::Cpu;
        
        let tensor = Tensor::from_vec(data, &shape, &device)
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        
        Ok(TensorWrapper { tensor })
    }

    /// Perform matrix multiplication with SIMD optimization
    #[napi]
    pub fn matmul(a: &TensorWrapper, b: &TensorWrapper) -> napi::Result<TensorWrapper> {
        let _timer = Timer::new("tensor_matmul");
        
        let result = a.tensor.matmul(&b.tensor)
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        
        Ok(TensorWrapper { tensor: result })
    }

    /// Element-wise addition
    #[napi]
    pub fn add(a: &TensorWrapper, b: &TensorWrapper) -> napi::Result<TensorWrapper> {
        let result = (&a.tensor + &b.tensor)
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        
        Ok(TensorWrapper { tensor: result })
    }

    /// Element-wise multiplication
    #[napi]
    pub fn mul(a: &TensorWrapper, b: &TensorWrapper) -> napi::Result<TensorWrapper> {
        let result = (&a.tensor * &b.tensor)
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        
        Ok(TensorWrapper { tensor: result })
    }

    /// Compute softmax
    #[napi]
    pub fn softmax(tensor: &TensorWrapper, dim: i32) -> napi::Result<TensorWrapper> {
        let _timer = Timer::new("tensor_softmax");
        
        let dim = if dim < 0 {
            (tensor.tensor.dims().len() as i32 + dim) as usize
        } else {
            dim as usize
        };
        
        let result = candle_nn::ops::softmax(&tensor.tensor, dim)
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        
        Ok(TensorWrapper { tensor: result })
    }

    /// Compute layer normalization
    #[napi]
    pub fn layer_norm(
        tensor: &TensorWrapper,
        normalized_shape: Vec<u32>,
        weight: Option<&TensorWrapper>,
        bias: Option<&TensorWrapper>,
        eps: Option<f64>,
    ) -> napi::Result<TensorWrapper> {
        let _timer = Timer::new("tensor_layer_norm");
        
        let normalized_shape: Vec<usize> = normalized_shape.iter().map(|&x| x as usize).collect();
        let eps = eps.unwrap_or(1e-5);
        
        let result = candle_nn::ops::layer_norm(
            &tensor.tensor,
            &normalized_shape,
            weight.map(|w| &w.tensor),
            bias.map(|b| &b.tensor),
            eps,
        ).map_err(|e| NativeError::tensor_op(e.to_string()))?;
        
        Ok(TensorWrapper { tensor: result })
    }

    /// Apply ReLU activation
    #[napi]
    pub fn relu(tensor: &TensorWrapper) -> napi::Result<TensorWrapper> {
        let result = tensor.tensor.relu()
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        
        Ok(TensorWrapper { tensor: result })
    }

    /// Apply GELU activation
    #[napi]
    pub fn gelu(tensor: &TensorWrapper) -> napi::Result<TensorWrapper> {
        let result = candle_nn::ops::gelu(&tensor.tensor)
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        
        Ok(TensorWrapper { tensor: result })
    }

    /// Compute attention weights
    #[napi]
    pub fn attention(
        query: &TensorWrapper,
        key: &TensorWrapper,
        value: &TensorWrapper,
        mask: Option<&TensorWrapper>,
        scale: Option<f64>,
    ) -> napi::Result<TensorWrapper> {
        let _timer = Timer::new("tensor_attention");
        
        // Compute Q * K^T
        let key_t = key.tensor.t()
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        let scores = query.tensor.matmul(&key_t)
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        
        // Apply scaling
        let scores = if let Some(scale) = scale {
            scores * scale
        } else {
            let d_k = key.tensor.dim(key.tensor.dims().len() - 1)
                .map_err(|e| NativeError::tensor_op(e.to_string()))? as f64;
            scores * (1.0 / d_k.sqrt())
        };
        
        // Apply mask if provided
        let scores = if let Some(mask) = mask {
            let large_neg = -1e9_f64;
            let mask_expanded = mask.tensor.broadcast_as(scores.shape())
                .map_err(|e| NativeError::tensor_op(e.to_string()))?;
            scores.where_cond(&mask_expanded, &scores.zeros_like()? + large_neg)?
        } else {
            scores
        };
        
        // Apply softmax
        let attention_weights = candle_nn::ops::softmax(&scores, scores.dims().len() - 1)
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        
        // Apply to values
        let result = attention_weights.matmul(&value.tensor)
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        
        Ok(TensorWrapper { tensor: result })
    }

    /// Parallel reduction operations
    #[napi]
    pub fn parallel_sum(tensor: &TensorWrapper, dim: Option<i32>) -> napi::Result<TensorWrapper> {
        let _timer = Timer::new("tensor_parallel_sum");
        
        let result = if let Some(dim) = dim {
            let dim = if dim < 0 {
                (tensor.tensor.dims().len() as i32 + dim) as usize
            } else {
                dim as usize
            };
            tensor.tensor.sum(dim)
                .map_err(|e| NativeError::tensor_op(e.to_string()))?
        } else {
            tensor.tensor.sum_all()
                .map_err(|e| NativeError::tensor_op(e.to_string()))?
        };
        
        Ok(TensorWrapper { tensor: result })
    }

    /// Efficient tensor concatenation
    #[napi]
    pub fn concat(tensors: Vec<&TensorWrapper>, dim: u32) -> napi::Result<TensorWrapper> {
        let _timer = Timer::new("tensor_concat");
        
        let tensor_refs: Vec<&Tensor> = tensors.iter().map(|t| &t.tensor).collect();
        let result = Tensor::cat(&tensor_refs, dim as usize)
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        
        Ok(TensorWrapper { tensor: result })
    }

    /// Tensor reshaping
    #[napi]
    pub fn reshape(tensor: &TensorWrapper, shape: Vec<u32>) -> napi::Result<TensorWrapper> {
        let shape: Vec<usize> = shape.iter().map(|&x| x as usize).collect();
        let result = tensor.tensor.reshape(&shape)
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        
        Ok(TensorWrapper { tensor: result })
    }

    /// Tensor transpose
    #[napi]
    pub fn transpose(tensor: &TensorWrapper, dim1: u32, dim2: u32) -> napi::Result<TensorWrapper> {
        let result = tensor.tensor.transpose(dim1 as usize, dim2 as usize)
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        
        Ok(TensorWrapper { tensor: result })
    }
}

/// Wrapper for Candle tensors to work with NAPI
#[napi]
pub struct TensorWrapper {
    pub(crate) tensor: Tensor,
}

#[napi]
impl TensorWrapper {
    /// Get tensor shape
    #[napi]
    pub fn shape(&self) -> Vec<u32> {
        self.tensor.dims().iter().map(|&x| x as u32).collect()
    }

    /// Get tensor data type
    #[napi]
    pub fn dtype(&self) -> String {
        format!("{:?}", self.tensor.dtype())
    }

    /// Get tensor element count
    #[napi]
    pub fn elem_count(&self) -> u32 {
        self.tensor.elem_count() as u32
    }

    /// Convert tensor to flat array
    #[napi]
    pub fn to_vec(&self) -> napi::Result<Vec<f32>> {
        let result = self.tensor.flatten_all()
            .map_err(|e| NativeError::tensor_op(e.to_string()))?
            .to_vec1::<f32>()
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        
        Ok(result)
    }

    /// Get a scalar value (for 0-dimensional tensors)
    #[napi]
    pub fn to_scalar(&self) -> napi::Result<f32> {
        let result = self.tensor.to_scalar::<f32>()
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        
        Ok(result)
    }

    /// Clone the tensor
    #[napi]
    pub fn clone(&self) -> TensorWrapper {
        TensorWrapper {
            tensor: self.tensor.clone(),
        }
    }

    /// Move tensor to different device (if supported)
    #[napi]
    pub fn to_device(&self, device_type: String) -> napi::Result<TensorWrapper> {
        let device = match device_type.as_str() {
            "cpu" => Device::Cpu,
            #[cfg(feature = "gpu")]
            "cuda" => Device::Cuda(candle_core::CudaDevice::new(0)
                .map_err(|e| NativeError::tensor_op(e.to_string()))?),
            _ => return Err(NativeError::invalid_input(format!("Unsupported device: {}", device_type)).into()),
        };

        let result = self.tensor.to_device(&device)
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        
        Ok(TensorWrapper { tensor: result })
    }

    /// Convert tensor data type
    #[napi]
    pub fn to_dtype(&self, dtype: String) -> napi::Result<TensorWrapper> {
        let target_dtype = match dtype.as_str() {
            "f32" => DType::F32,
            "f16" => DType::F16,
            "i64" => DType::I64,
            "u32" => DType::U32,
            _ => return Err(NativeError::invalid_input(format!("Unsupported dtype: {}", dtype)).into()),
        };

        let result = self.tensor.to_dtype(target_dtype)
            .map_err(|e| NativeError::tensor_op(e.to_string()))?;
        
        Ok(TensorWrapper { tensor: result })
    }
}

/// SIMD-optimized operations
pub mod simd {
    use super::*;
    use wide::f32x8;
    
    /// SIMD vector addition
    #[cfg(target_arch = "x86_64")]
    pub fn add_vectors_simd(a: &[f32], b: &[f32]) -> Vec<f32> {
        if !is_x86_feature_detected!("avx") || a.len() != b.len() {
            return a.iter().zip(b.iter()).map(|(x, y)| x + y).collect();
        }
        
        let mut result = Vec::with_capacity(a.len());
        let chunks_a = a.chunks_exact(8);
        let chunks_b = b.chunks_exact(8);
        let remainder_a = chunks_a.remainder();
        let remainder_b = chunks_b.remainder();
        
        for (chunk_a, chunk_b) in chunks_a.zip(chunks_b) {
            let vec_a = f32x8::from_array(*chunk_a.try_into().unwrap());
            let vec_b = f32x8::from_array(*chunk_b.try_into().unwrap());
            let sum = vec_a + vec_b;
            result.extend_from_slice(&sum.to_array());
        }
        
        // Handle remainder
        result.extend(remainder_a.iter().zip(remainder_b.iter()).map(|(x, y)| x + y));
        result
    }
    
    /// Fallback for non-x86 architectures
    #[cfg(not(target_arch = "x86_64"))]
    pub fn add_vectors_simd(a: &[f32], b: &[f32]) -> Vec<f32> {
        a.iter().zip(b.iter()).map(|(x, y)| x + y).collect()
    }
    
    /// SIMD dot product
    #[cfg(target_arch = "x86_64")]
    pub fn dot_product_simd(a: &[f32], b: &[f32]) -> f32 {
        if !is_x86_feature_detected!("avx") || a.len() != b.len() {
            return a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        }
        
        let mut sum = f32x8::ZERO;
        let chunks_a = a.chunks_exact(8);
        let chunks_b = b.chunks_exact(8);
        let remainder_a = chunks_a.remainder();
        let remainder_b = chunks_b.remainder();
        
        for (chunk_a, chunk_b) in chunks_a.zip(chunks_b) {
            let vec_a = f32x8::from_array(*chunk_a.try_into().unwrap());
            let vec_b = f32x8::from_array(*chunk_b.try_into().unwrap());
            sum += vec_a * vec_b;
        }
        
        let mut result = sum.reduce_add();
        
        // Handle remainder
        result += remainder_a.iter().zip(remainder_b.iter()).map(|(x, y)| x * y).sum::<f32>();
        result
    }
    
    /// Fallback for non-x86 architectures
    #[cfg(not(target_arch = "x86_64"))]
    pub fn dot_product_simd(a: &[f32], b: &[f32]) -> f32 {
        a.iter().zip(b.iter()).map(|(x, y)| x * y).sum()
    }
}

/// Benchmark tensor operations
#[napi]
pub async fn benchmark_tensor_ops(
    size: u32,
    operation: String,
    iterations: u32,
) -> napi::Result<f64> {
    let data: Vec<f32> = (0..size).map(|i| i as f32).collect();
    let shape = vec![size];
    
    let tensor_a = TensorOps::from_data(data.clone(), shape.clone())?;
    let tensor_b = TensorOps::from_data(data, shape)?;
    
    let start = std::time::Instant::now();
    
    for _ in 0..iterations {
        let _result = match operation.as_str() {
            "add" => TensorOps::add(&tensor_a, &tensor_b)?,
            "mul" => TensorOps::mul(&tensor_a, &tensor_b)?,
            "matmul" => {
                // Reshape for matrix multiplication
                let sqrt_size = (size as f64).sqrt() as u32;
                let reshaped_a = TensorOps::reshape(&tensor_a, vec![sqrt_size, sqrt_size])?;
                let reshaped_b = TensorOps::reshape(&tensor_b, vec![sqrt_size, sqrt_size])?;
                TensorOps::matmul(&reshaped_a, &reshaped_b)?
            }
            "softmax" => TensorOps::softmax(&tensor_a, -1)?,
            _ => return Err(NativeError::invalid_input(format!("Unknown operation: {}", operation)).into()),
        };
    }
    
    let duration = start.elapsed();
    let ops_per_sec = iterations as f64 / duration.as_secs_f64();
    
    Ok(ops_per_sec)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_tensor_creation() {
        let data = vec![1.0, 2.0, 3.0, 4.0];
        let shape = vec![2, 2];
        let tensor = TensorOps::from_data(data, shape).unwrap();
        
        assert_eq!(tensor.shape(), vec![2, 2]);
        assert_eq!(tensor.elem_count(), 4);
    }
    
    #[test]
    fn test_tensor_operations() {
        let data_a = vec![1.0, 2.0, 3.0, 4.0];
        let data_b = vec![5.0, 6.0, 7.0, 8.0];
        let shape = vec![2, 2];
        
        let tensor_a = TensorOps::from_data(data_a, shape.clone()).unwrap();
        let tensor_b = TensorOps::from_data(data_b, shape).unwrap();
        
        let result = TensorOps::add(&tensor_a, &tensor_b).unwrap();
        let result_data = result.to_vec().unwrap();
        
        assert_eq!(result_data, vec![6.0, 8.0, 10.0, 12.0]);
    }
    
    #[test]
    fn test_simd_operations() {
        let a = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let b = vec![8.0, 7.0, 6.0, 5.0, 4.0, 3.0, 2.0, 1.0];
        
        let result = simd::add_vectors_simd(&a, &b);
        assert_eq!(result, vec![9.0; 8]);
        
        let dot_result = simd::dot_product_simd(&a, &b);
        assert_eq!(dot_result, 120.0);
    }
}