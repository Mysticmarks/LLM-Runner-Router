#!/bin/bash

# Clean up duplicate exports
for file in "$@"; do
  echo "Cleaning $file"
  
  # Remove duplicate "export default" lines and fix exports
  # Keep only one export default and one named export
  classname=$(grep "^class " "$file" | head -1 | sed 's/class \([^ {]*\).*/\1/')
  
  if [ ! -z "$classname" ]; then
    # Remove all export lines at the end
    sed -i '/^export default/d' "$file"
    sed -i '/^export {/d' "$file"
    
    # Add clean exports
    echo "" >> "$file"
    echo "export default $classname;" >> "$file"
    echo "export { $classname };" >> "$file"
  fi
done

echo "Cleanup complete!"