// Copyright (C) 2022-2025 cooklang contributors, Subhajit Sahu
// SPDX-License-Identifier: AGPL-3.0-or-later
// See LICENSE for full terms

// Import assertion functions and path module from Deno standard library
import { assertEquals } from "https://deno.land/std/assert/mod.ts";
import * as path from "https://deno.land/std/path/mod.ts";
// Import YAML parsing function from Deno standard library
import { parse } from "https://deno.land/std/yaml/parse.ts";

// Import the code to be tested (adjust extensions if needed, .ts is common in Deno)
import { Parser } from '../src/index.ts';
// Import types if needed (adjust extensions if needed)
// import { Step } from '../src/cooklang.ts'; // Only needed if used directly in test logic beyond comparison

// --- Test Setup ---
const parser = new Parser();
const testsPath = "./tests"; // Relative path to the test YAML files

// --- Test Discovery and Execution ---

// Iterate over directory entries synchronously
for (const entry of Deno.readDirSync(testsPath)) {
  // Process only files ending with .yaml
  if (entry.isFile && entry.name.endsWith(".yaml")) {
    const testFile = entry.name;
    const testFilePath = path.join(testsPath, testFile); // Construct full path

    // Define a test suite for the current YAML file
    // Using async (t) allows for using t.step() for sub-tests
    Deno.test(testFile, async (t) => {
      // Read the YAML file content
      const testYaml = Deno.readTextFileSync(testFilePath);

      // Parse the YAML content. std/yaml/parse returns unknown.
      // Add type assertion and basic structure check.
      const testData = parse(testYaml) as {
        tests?: Record<string, { source: string; result: any }>;
      };

      // Handle cases where YAML is empty or doesn't have the expected 'tests' key
      if (!testData?.tests) {
         console.warn(`Skipping ${testFile}: Invalid YAML structure or missing 'tests' key.`);
         // Optionally fail the test suite if the structure is mandatory
         // assert(false, `Invalid YAML structure in ${testFile}`);
         return; // Skip tests for this file
      }

      // Iterate over each test case defined within the YAML file
      for (const [name, testEntry] of Object.entries(testData.tests)) {
        // Define an individual test step for this case
        await t.step(name, () => {
          const { source, result } = testEntry;

          // Run the parser with the source text from the test case
          const parsed = parser.parse(source);

          // Prepare the expected result structure from the YAML data
          // (Handles potential empty array representation for metadata)
          const expected = {
            steps: result.steps,
            metadata: Array.isArray(result.metadata) ? {} : result.metadata,
          };

          // Prepare the actual result structure from the parser output
          const actual = {
            steps: parsed.steps,
            metadata: parsed.metadata,
          };

          // Assert deep equality between the actual and expected results
          assertEquals(actual, expected);
        });
      }
    });
  }
}



// import * as fs from 'fs';
// import * as yaml from 'yaml';
// import { Parser } from '../src/index';
// import { Step } from '../src/cooklang';

// const parser = new Parser();

// const testsPath = "./tests";
// const testFiles = fs.readdirSync(testsPath).filter((f) => f.endsWith(".yaml"));

// testFiles.forEach((testFile) => {
//   const testYaml = fs.readFileSync(`${testsPath}/${testFile}`, "utf-8");
//   const testData = yaml.parse(testYaml).tests as Record<
//   string,
//   { source: string; result: any }
//   >;

//   describe(testFile, () => {
//   Object.entries(testData).forEach(([name, testEntry]) => {
//     it(name, () => {
//     const { source, result } = testEntry;
//     const parsed = parser.parse(source);

//     const expected = {
//       steps: result.steps,
//       metadata: Array.isArray(result.metadata) ? {} : result.metadata,
//     };

//     const actual = {
//       steps: parsed.steps,
//       metadata: parsed.metadata,
//     };

//     expect(expected).toStrictEqual(actual);
//     });
//   });
//   });
// });
