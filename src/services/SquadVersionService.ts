import * as https from 'https';
import { execSync } from 'child_process';

export interface UpgradeCheckResult {
    available: boolean;
    currentVersion?: string;
    latestVersion?: string;
}

export class SquadVersionService {
    private lastResult: UpgradeCheckResult | undefined;
    private checked = false;

    /**
     * Check if an upgrade is available. Returns cached result after first call.
     */
    async checkForUpgrade(): Promise<UpgradeCheckResult> {
        if (this.checked && this.lastResult) {
            return this.lastResult;
        }
        return this.forceCheck();
    }

    /**
     * Force a fresh check, bypassing cache.
     */
    async forceCheck(): Promise<UpgradeCheckResult> {
        try {
            const [latest, current] = await Promise.all([
                this.getLatestVersion(),
                this.getInstalledVersion()
            ]);

            if (!latest || !current) {
                this.lastResult = { available: false, currentVersion: current, latestVersion: latest };
            } else {
                const available = this.isNewer(latest, current);
                this.lastResult = { available, currentVersion: current, latestVersion: latest };
            }
        } catch {
            this.lastResult = { available: false };
        }
        this.checked = true;
        return this.lastResult;
    }

    /**
     * Reset cache so next checkForUpgrade() will re-fetch.
     */
    resetCache(): void {
        this.checked = false;
        this.lastResult = undefined;
    }

    private getLatestVersion(): Promise<string | undefined> {
        return new Promise((resolve) => {
            const options: https.RequestOptions = {
                hostname: 'api.github.com',
                path: '/repos/bradygaster/squad/releases/latest',
                headers: {
                    'User-Agent': 'SquadUI-VSCode',
                    'Accept': 'application/vnd.github.v3+json'
                },
                timeout: 10000
            };

            const req = https.get(options, (res) => {
                // Follow redirects (GitHub API returns 302 sometimes)
                if (res.statusCode === 301 || res.statusCode === 302) {
                    const location = res.headers.location;
                    if (location) {
                        https.get(location, { headers: options.headers, timeout: 10000 }, (redirectRes) => {
                            this.readJsonResponse(redirectRes).then(resolve);
                        }).on('error', () => resolve(undefined));
                        return;
                    }
                }

                if (res.statusCode !== 200) {
                    resolve(undefined);
                    return;
                }

                this.readJsonResponse(res).then(resolve);
            });

            req.on('error', () => resolve(undefined));
            req.on('timeout', () => {
                req.destroy();
                resolve(undefined);
            });
        });
    }

    private readJsonResponse(res: import('http').IncomingMessage): Promise<string | undefined> {
        return new Promise((resolve) => {
            let data = '';
            res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data) as { tag_name?: string };
                    const tag = json.tag_name;
                    resolve(tag ? this.normalizeVersion(tag) : undefined);
                } catch {
                    resolve(undefined);
                }
            });
            res.on('error', () => resolve(undefined));
        });
    }

    private async getInstalledVersion(): Promise<string | undefined> {
        try {
            const output = execSync('npx github:bradygaster/squad --version', {
                timeout: 15000,
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe']
            });
            const trimmed = output.trim();
            // Version might be on its own line or prefixed with text
            const match = trimmed.match(/(\d+\.\d+\.\d+)/);
            return match ? match[1] : undefined;
        } catch {
            return undefined;
        }
    }

    private normalizeVersion(version: string): string {
        return version.replace(/^v/i, '').trim();
    }

    /**
     * Returns true if latest is newer than current (simple semver comparison).
     */
    private isNewer(latest: string, current: string): boolean {
        const latestParts = latest.split('.').map(Number);
        const currentParts = current.split('.').map(Number);

        for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
            const l = latestParts[i] || 0;
            const c = currentParts[i] || 0;
            if (l > c) { return true; }
            if (l < c) { return false; }
        }
        return false;
    }
}
