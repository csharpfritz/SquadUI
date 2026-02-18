namespace SquadUI.VS2026.Core.Services;

/// <summary>
/// Event types emitted by the file watcher.
/// </summary>
public enum FileWatcherEventType
{
    /// <summary>A file was created.</summary>
    Created,
    /// <summary>A file was changed.</summary>
    Changed,
    /// <summary>A file was deleted.</summary>
    Deleted
}

/// <summary>
/// Event data emitted when a watched file changes.
/// </summary>
public sealed class FileWatcherEvent
{
    /// <summary>Type of file system event.</summary>
    public required FileWatcherEventType Type { get; init; }

    /// <summary>Full path to the changed file.</summary>
    public required string FullPath { get; init; }

    /// <summary>When the event was queued.</summary>
    public DateTime Timestamp { get; init; } = DateTime.UtcNow;
}

/// <summary>
/// Watches the .ai-team directory for file changes using <see cref="FileSystemWatcher"/>
/// with 300ms debounce. Mirrors the TypeScript FileWatcherService behavior.
/// </summary>
public sealed class FileWatcherService : IDisposable
{
    private const int DefaultDebounceMs = 300;

    private readonly int _debounceMs;
    private FileSystemWatcher? _watcher;
    private Timer? _debounceTimer;
    private readonly Dictionary<string, FileWatcherEvent> _pendingEvents = new();
    private readonly object _lock = new();
    private bool _disposed;

    /// <summary>
    /// Fires after the debounce window elapses with all coalesced events.
    /// </summary>
    public event Action<IReadOnlyList<FileWatcherEvent>>? OnChanged;

    /// <summary>
    /// Creates a new FileWatcherService.
    /// </summary>
    /// <param name="debounceMs">Debounce delay in milliseconds (default: 300).</param>
    public FileWatcherService(int debounceMs = DefaultDebounceMs)
    {
        _debounceMs = debounceMs;
    }

    /// <summary>
    /// Whether the watcher is currently active.
    /// </summary>
    public bool IsWatching => _watcher is not null && !_disposed;

    /// <summary>
    /// Starts watching the specified directory for markdown file changes.
    /// Safe to call multiple times; subsequent calls are no-ops.
    /// </summary>
    /// <param name="directoryPath">Path to the directory to watch (e.g., .ai-team folder).</param>
    public void Start(string directoryPath)
    {
        if (_watcher is not null || _disposed)
        {
            return;
        }

        if (!Directory.Exists(directoryPath))
        {
            return;
        }

        _watcher = new FileSystemWatcher(directoryPath)
        {
            Filter = "*.md",
            IncludeSubdirectories = true,
            NotifyFilter = NotifyFilters.FileName
                         | NotifyFilters.LastWrite
                         | NotifyFilters.CreationTime,
            EnableRaisingEvents = true
        };

        _watcher.Created += (_, e) => QueueEvent(FileWatcherEventType.Created, e.FullPath);
        _watcher.Changed += (_, e) => QueueEvent(FileWatcherEventType.Changed, e.FullPath);
        _watcher.Deleted += (_, e) => QueueEvent(FileWatcherEventType.Deleted, e.FullPath);
        _watcher.Renamed += (_, e) =>
        {
            QueueEvent(FileWatcherEventType.Deleted, e.OldFullPath);
            QueueEvent(FileWatcherEventType.Created, e.FullPath);
        };
    }

    /// <summary>
    /// Stops watching and cleans up resources.
    /// </summary>
    public void Stop()
    {
        lock (_lock)
        {
            _debounceTimer?.Dispose();
            _debounceTimer = null;
            _pendingEvents.Clear();
        }

        if (_watcher is not null)
        {
            _watcher.EnableRaisingEvents = false;
            _watcher.Dispose();
            _watcher = null;
        }
    }

    /// <inheritdoc />
    public void Dispose()
    {
        if (_disposed) { return; }
        _disposed = true;
        Stop();
    }

    // ─── Private Helpers ───────────────────────────────────────────────────

    private void QueueEvent(FileWatcherEventType type, string fullPath)
    {
        if (_disposed) { return; }

        var evt = new FileWatcherEvent { Type = type, FullPath = fullPath };

        lock (_lock)
        {
            // Coalesce by path — last event for each path wins
            _pendingEvents[fullPath] = evt;
            ScheduleFlush();
        }
    }

    private void ScheduleFlush()
    {
        // Reset the debounce timer each time a new event arrives
        _debounceTimer?.Dispose();
        _debounceTimer = new Timer(_ => FlushPendingEvents(), null, _debounceMs, Timeout.Infinite);
    }

    private void FlushPendingEvents()
    {
        List<FileWatcherEvent> events;

        lock (_lock)
        {
            if (_disposed || _pendingEvents.Count == 0)
            {
                return;
            }

            events = [.. _pendingEvents.Values];
            _pendingEvents.Clear();
            _debounceTimer?.Dispose();
            _debounceTimer = null;
        }

        // Fire on the thread-pool; callers should marshal to UI if needed
        OnChanged?.Invoke(events);
    }
}
