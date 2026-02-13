/**
 * Test runner for VS Code extension tests.
 * Launches VS Code with the extension loaded and runs the test suite.
 */

import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
        });
    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}

main();
