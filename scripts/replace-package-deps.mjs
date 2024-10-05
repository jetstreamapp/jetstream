import fs from 'fs-extra';
import path from 'path';

async function replaceDependencies() {
  try {
    // Define the paths to the package.json files
    const rootPackageJsonPath = path.resolve('package.json');
    const distPackageJsonPath = path.resolve('dist/apps/api/package.json');

    // Read the package.json files
    const [rootPackageJsonData, distPackageJsonData] = await Promise.all([
      fs.readFile(rootPackageJsonPath, 'utf-8'),
      fs.readFile(distPackageJsonPath, 'utf-8'),
    ]);

    // Parse the JSON data
    const rootPackageJson = JSON.parse(rootPackageJsonData);
    const distPackageJson = JSON.parse(distPackageJsonData);

    const xlsx = rootPackageJson.dependencies.xlsx;

    // Replace the dependencies and devDependencies
    rootPackageJson.dependencies = distPackageJson.dependencies;
    rootPackageJson.dependencies.xlsx = xlsx;
    rootPackageJson.devDependencies = {};

    // Write the updated package.json back to the root package.json file
    await fs.writeFile(rootPackageJsonPath, JSON.stringify(rootPackageJson, null, 2), 'utf-8');

    console.log('Dependencies successfully replaced in package.json');
  } catch (error) {
    console.error('Error replacing dependencies:', error);
  }
}

// Run the function
replaceDependencies();
