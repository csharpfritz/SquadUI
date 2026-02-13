---
name: "nodejs-api-client-caching"
description: "Pattern for building Node.js API clients with TTL-based caching and no external dependencies"
domain: "backend-services"
confidence: "low"
source: "earned"
---

## Context
When building API clients in Node.js (especially VS Code extensions or CLI tools that must stay zero/low-dependency), use the built-in `https` module with a simple TTL cache. This avoids polyfill issues with `fetch` in CommonJS environments and keeps the dependency footprint minimal.

## Patterns

### TTL Cache with Forced Refresh
Store fetched data alongside a `fetchedAt` timestamp. Check expiry on access. Expose `forceRefresh` parameter and `invalidateCache()` method for external triggers (e.g., file watchers).

```typescript
interface Cache<T> {
    data: T;
    fetchedAt: number;
}

class ApiService {
    private cache: Cache<MyData[]> | null = null;
    private cacheTtlMs: number;

    private isCacheExpired(): boolean {
        if (!this.cache) return true;
        return Date.now() - this.cache.fetchedAt > this.cacheTtlMs;
    }

    async getData(forceRefresh = false): Promise<MyData[]> {
        if (!forceRefresh && this.cache && !this.isCacheExpired()) {
            return this.cache.data;
        }
        const data = await this.fetchFromApi();
        this.cache = { data, fetchedAt: Date.now() };
        return data;
    }

    invalidateCache(): void {
        this.cache = null;
    }
}
```

### Node.js HTTPS GET with Promise Wrapper
Wrap `https.request` in a typed Promise. Set `User-Agent` (required by GitHub API), handle status codes, and parse JSON response.

```typescript
private apiGet<T>(path: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const url = new URL(path, this.baseUrl);
        const req = https.request({
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'GET',
            headers: { 'User-Agent': 'MyApp', 'Accept': 'application/json' },
        }, (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf-8');
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(body) as T);
                } else {
                    reject(new Error(`API returned ${res.statusCode}`));
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}
```

### Graceful Pagination
When paginating API results, catch errors per-page. If a later page fails, return the pages already fetched rather than losing everything.

## Anti-Patterns
- **Using `node-fetch` or `axios` in zero-dep projects** — Use `https` module instead.
- **Global mutable cache** — Keep cache as instance state so tests can create isolated instances.
- **Infinite cache without invalidation** — Always provide `invalidateCache()` and TTL expiry.
- **Tight coupling to auth mechanism** — Accept token via constructor/setter, don't import VS Code APIs directly.
