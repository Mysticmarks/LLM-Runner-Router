#!/bin/bash

# Fix loader files with multiple class exports

# SimpleLoader
sed -i '/^export default SimpleModel/d' src/loaders/SimpleLoader.js
sed -i '/^export { SimpleModel }/d' src/loaders/SimpleLoader.js

# BinaryLoader  
sed -i '/^export default BinaryModel/d' src/loaders/BinaryLoader.js
sed -i '/^export { BinaryModel }/d' src/loaders/BinaryLoader.js

# GGUFLoader
sed -i '/^export default GGUFModel/d' src/loaders/GGUFLoader.js
sed -i '/^export { GGUFModel }/d' src/loaders/GGUFLoader.js

# PyTorchLoader
sed -i '/^export default PyTorchModel/d' src/loaders/PyTorchLoader.js
sed -i '/^export { PyTorchModel }/d' src/loaders/PyTorchLoader.js

# ModelDownloader - has duplicate export default
sed -i '/^export default modelDownloader/d' src/services/ModelDownloader.js
# Keep the class export
sed -i 's/^export default ModelDownloader;$/export default ModelDownloader;/' src/services/ModelDownloader.js

echo "Loader fixes complete!"