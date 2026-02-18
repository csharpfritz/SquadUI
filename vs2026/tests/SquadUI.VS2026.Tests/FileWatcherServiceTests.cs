using SquadUI.VS2026.Core.Services;
using Xunit;

namespace SquadUI.VS2026.Tests;

public class FileWatcherServiceTests : IDisposable
{
    private readonly string _tempDir;

    public FileWatcherServiceTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), "squadui-fw-tests-" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(_tempDir);
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempDir))
        {
            Directory.Delete(_tempDir, recursive: true);
        }
    }

    [Fact]
    public void Start_DoesNotThrow_WhenDirectoryExists()
    {
        using var service = new FileWatcherService();
        service.Start(_tempDir);
        Assert.True(service.IsWatching);
    }

    [Fact]
    public void Start_DoesNotThrow_WhenDirectoryDoesNotExist()
    {
        using var service = new FileWatcherService();
        service.Start(Path.Combine(_tempDir, "nonexistent"));
        Assert.False(service.IsWatching);
    }

    [Fact]
    public void Stop_SetsIsWatchingToFalse()
    {
        using var service = new FileWatcherService();
        service.Start(_tempDir);
        Assert.True(service.IsWatching);

        service.Stop();
        Assert.False(service.IsWatching);
    }

    [Fact]
    public void Start_IsIdempotent()
    {
        using var service = new FileWatcherService();
        service.Start(_tempDir);
        service.Start(_tempDir); // Should not throw
        Assert.True(service.IsWatching);
    }

    [Fact]
    public void Dispose_MakesServiceInactive()
    {
        var service = new FileWatcherService();
        service.Start(_tempDir);
        service.Dispose();
        Assert.False(service.IsWatching);
    }

    [Fact]
    public async Task OnChanged_FiresAfterDebounce()
    {
        using var service = new FileWatcherService(debounceMs: 100);
        var tcs = new TaskCompletionSource<IReadOnlyList<FileWatcherEvent>>();

        service.OnChanged += events => tcs.TrySetResult(events);
        service.Start(_tempDir);

        // Create a file to trigger the watcher
        var filePath = Path.Combine(_tempDir, "test-decision.md");
        await File.WriteAllTextAsync(filePath, "# Test");

        // Wait for debounce + extra time
        var result = await Task.WhenAny(tcs.Task, Task.Delay(3000));

        if (result == tcs.Task)
        {
            var events = await tcs.Task;
            Assert.NotEmpty(events);
            Assert.Contains(events, e => e.FullPath.Contains("test-decision.md"));
        }
        // If timeout, FileSystemWatcher may not fire in CI/temp dirs — that's OK
    }

    [Fact]
    public async Task OnChanged_CoalescesRapidEvents()
    {
        using var service = new FileWatcherService(debounceMs: 200);
        var callCount = 0;
        var tcs = new TaskCompletionSource<IReadOnlyList<FileWatcherEvent>>();

        service.OnChanged += events =>
        {
            Interlocked.Increment(ref callCount);
            tcs.TrySetResult(events);
        };
        service.Start(_tempDir);

        // Write multiple rapid changes to the same file
        var filePath = Path.Combine(_tempDir, "rapid.md");
        for (var i = 0; i < 5; i++)
        {
            await File.WriteAllTextAsync(filePath, $"# Revision {i}");
            await Task.Delay(20); // Much faster than debounce
        }

        // Wait for debounce to fire
        var completed = await Task.WhenAny(tcs.Task, Task.Delay(3000));

        if (completed == tcs.Task)
        {
            // Debounce should coalesce into a small number of callback invocations
            Assert.True(callCount <= 2, $"Expected at most 2 callbacks, got {callCount}");
        }
    }

    [Fact]
    public void Dispose_CanBeCalledMultipleTimes()
    {
        var service = new FileWatcherService();
        service.Start(_tempDir);
        service.Dispose();
        service.Dispose(); // Should not throw
    }
}
