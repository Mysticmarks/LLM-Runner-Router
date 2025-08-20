#!/bin/bash

# Fix duplicate exports in all files
for file in $(find src -name "*.js" -exec grep -l "^export class" {} \;); do
  echo "Fixing $file"
  # Replace "export class" with just "class"
  sed -i 's/^export class /class /' "$file"
  
  # Check if the file already has an export at the end
  classname=$(grep "^class " "$file" | head -1 | sed 's/class \([^ {]*\).*/\1/')
  
  if [ ! -z "$classname" ]; then
    # Check if export already exists
    if ! grep -q "export { $classname }" "$file"; then
      # Add exports at the end if not present
      echo "" >> "$file"
      echo "export default $classname;" >> "$file"
      echo "export { $classname };" >> "$file"
    fi
  fi
done

echo "Export fixes complete!"