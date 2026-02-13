---
name: "vscode-optional-service-injection"
description: "Pattern for VS Code tree views that consume optional services with graceful degradation"
domain: "vscode-extensions"
confidence: "low"
source: "earned"
---

## Context
VS Code tree views often need data from services that may not be available at activation time (e.g., API services requiring auth tokens, services built by other team members in parallel). The tree should work without the service and enhance when it becomes available.

## Patterns

### Late-Binding via Setter
Instead of requiring the service in the constructor, expose a `setService()` method. This allows the extension to wire the service when available without blocking tree view creation.

```typescript
export class MyTreeProvider implements vscode.TreeDataProvider<MyItem> {
    private optionalService: IMyService | undefined;

    constructor(private dataProvider: DataProvider) {}

    setService(service: IMyService): void {
        this.optionalService = service;
    }
}
```

### Guard + Try/Catch in Data Methods
When fetching optional data, check for service existence first, then wrap the call in try/catch to handle runtime failures (network errors, auth issues, etc.).

```typescript
private async getOptionalItems(): Promise<MyItem[]> {
    if (!this.optionalService) {
        return [];
    }
    try {
        const data = await this.optionalService.getData();
        return data.map(d => this.createItem(d));
    } catch {
        return [];
    }
}
```

### Interface-First Design
Define the contract in models (not in the service file) so consumers can compile without the concrete implementation existing yet.

```typescript
// src/models/index.ts
export interface IMyService {
    getData(root: string): Promise<Map<string, MyData[]>>;
}
```

## Anti-Patterns
- Don't make the service a constructor requirement — breaks activation when service isn't ready
- Don't let service errors bubble up to `getChildren()` — VS Code shows ugly error UI
- Don't import the concrete service class in the tree provider — import the interface only

## When to Use
- Tree view consumes data from an external API that may be offline
- Service is being built in parallel by another developer
- Service requires configuration (tokens, endpoints) that may not exist yet
