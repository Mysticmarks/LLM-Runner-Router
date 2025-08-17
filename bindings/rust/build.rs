use std::io::Result;

fn main() -> Result<()> {
    // Build gRPC protobuf definitions
    #[cfg(feature = "grpc")]
    {
        tonic_build::configure()
            .build_server(false)
            .build_client(true)
            .out_dir("src/generated")
            .compile(
                &["../../../src/proto/llm_router.proto"],
                &["../../../src/proto"],
            )?;
    }
    
    Ok(())
}