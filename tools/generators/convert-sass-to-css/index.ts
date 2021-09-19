import { Tree, formatFiles, readProjectConfiguration, joinPathFragments, logger, generateFiles } from '@nrwl/devkit';
import { runCommandsGenerator } from '@nrwl/workspace/generators';
import { join } from 'path';
import { renderSync } from 'sass';

interface ConvertSassToCssSchema {
  name: string;
  filename: string;
  outputFilename: string;
}

export default async function (tree: Tree, schema: ConvertSassToCssSchema) {
  const projectConfig = readProjectConfiguration(tree, schema.name);
  const inputFilename = join(projectConfig.root, schema.filename);
  const outputFilename = inputFilename.replace(/\.scss$/, '.css');

  if (!tree.exists(inputFilename)) {
    throw new Error(`File ${inputFilename} does not exist`);
  }

  logger.info(`Converting files from ${inputFilename} to ${outputFilename}`);

  const scssResults = renderSync({
    data: tree.read(inputFilename, 'utf-8'),
    includePaths: [join(tree.root, 'node_modules')],
    outputStyle: 'compressed',
  });

  tree.write(outputFilename, scssResults.css);

  // logger.info('Found project:' + JSON.stringify(projectConfig));

  // await libraryGenerator(tree, { name: schema.name });
  // await formatFiles(tree);
  // return () => {
  //   installPackagesTask(tree);
  // };
}
