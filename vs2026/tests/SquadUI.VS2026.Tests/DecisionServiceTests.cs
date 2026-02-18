using SquadUI.VS2026.Core.Services;
using Xunit;

namespace SquadUI.VS2026.Tests;

public class DecisionServiceTests : IDisposable
{
    private readonly string _tempDir;
    private readonly DecisionService _service;

    public DecisionServiceTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), "squadui-decision-tests-" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(_tempDir);
        _service = new DecisionService();
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempDir))
        {
            Directory.Delete(_tempDir, recursive: true);
        }
    }

    [Fact]
    public void GetDecisions_ReturnsEmpty_WhenNoFiles()
    {
        var result = _service.GetDecisions(_tempDir);
        Assert.Empty(result);
    }

    [Fact]
    public void GetDecisions_ParsesDecisionsMd_WithH2Headings()
    {
        File.WriteAllText(Path.Combine(_tempDir, "decisions.md"), """
            # Decisions

            ## Use xUnit for testing

            **Date:** 2026-01-15
            **Author:** Danny

            We decided to use xUnit for all C# testing.

            ## Adopt .NET 8.0

            **Date:** 2026-01-10
            **Author:** Linus

            Target .NET 8.0 for the extension.
            """);

        var decisions = _service.GetDecisions(_tempDir);

        Assert.Equal(2, decisions.Count);
        // Sorted newest first
        Assert.Equal("Use xUnit for testing", decisions[0].Title);
        Assert.Equal("2026-01-15", decisions[0].Date);
        Assert.Equal("Danny", decisions[0].Author);
        Assert.Equal("Adopt .NET 8.0", decisions[1].Title);
        Assert.Equal("2026-01-10", decisions[1].Date);
    }

    [Fact]
    public void GetDecisions_ParsesH3WithDatePrefix()
    {
        File.WriteAllText(Path.Combine(_tempDir, "decisions.md"), """
            # Decisions

            ### 2026-02-14: Use VS Extensibility SDK

            Adopted the out-of-process model.
            """);

        var decisions = _service.GetDecisions(_tempDir);

        Assert.Single(decisions);
        Assert.Equal("Use VS Extensibility SDK", decisions[0].Title);
        Assert.Equal("2026-02-14", decisions[0].Date);
    }

    [Fact]
    public void GetDecisions_SkipsSubsectionHeadings()
    {
        File.WriteAllText(Path.Combine(_tempDir, "decisions.md"), """
            # Decisions

            ## Use xUnit for testing

            **Date:** 2026-01-15

            ### Context

            We needed a testing framework.

            ### Decision

            Use xUnit.
            """);

        var decisions = _service.GetDecisions(_tempDir);

        // "Context" and "Decision" subsections should not be separate entries
        Assert.Single(decisions);
        Assert.Equal("Use xUnit for testing", decisions[0].Title);
    }

    [Fact]
    public void GetDecisions_ParsesH1DecisionFormat()
    {
        File.WriteAllText(Path.Combine(_tempDir, "decisions.md"), """
            # Decision: Adopt Markdown for docs

            **Date:** 2026-03-01
            **Author:** Scribe

            ## Context

            We needed a standard documentation format.
            """);

        var decisions = _service.GetDecisions(_tempDir);

        Assert.Single(decisions);
        Assert.Equal("Adopt Markdown for docs", decisions[0].Title);
        Assert.Equal("2026-03-01", decisions[0].Date);
        Assert.Equal("Scribe", decisions[0].Author);
    }

    [Fact]
    public void GetDecisions_ScansDecisionsDirectory()
    {
        var decisionsDir = Path.Combine(_tempDir, "decisions");
        Directory.CreateDirectory(decisionsDir);

        File.WriteAllText(Path.Combine(decisionsDir, "use-xunit.md"), """
            # Use xUnit for testing

            **Date:** 2026-01-15
            **Author:** Danny

            We decided to use xUnit.
            """);

        var decisions = _service.GetDecisions(_tempDir);

        Assert.Single(decisions);
        Assert.Equal("Use xUnit for testing", decisions[0].Title);
        Assert.Equal("2026-01-15", decisions[0].Date);
        Assert.Equal("Danny", decisions[0].Author);
    }

    [Fact]
    public void GetDecisions_SortsNewestFirst()
    {
        File.WriteAllText(Path.Combine(_tempDir, "decisions.md"), """
            ## Old decision

            **Date:** 2025-06-01

            ## New decision

            **Date:** 2026-06-01

            ## Middle decision

            **Date:** 2026-01-01
            """);

        var decisions = _service.GetDecisions(_tempDir);

        Assert.Equal(3, decisions.Count);
        Assert.Equal("New decision", decisions[0].Title);
        Assert.Equal("Middle decision", decisions[1].Title);
        Assert.Equal("Old decision", decisions[2].Title);
    }

    [Fact]
    public void GetDecisions_HandlesByMetadata()
    {
        File.WriteAllText(Path.Combine(_tempDir, "decisions.md"), """
            ## Some decision

            **Date:** 2026-04-01
            **By:** Rusty

            Content here.
            """);

        var decisions = _service.GetDecisions(_tempDir);

        Assert.Single(decisions);
        Assert.Equal("Rusty", decisions[0].Author);
    }

    [Fact]
    public void GetDecisions_StripsMalformedHeading()
    {
        File.WriteAllText(Path.Combine(_tempDir, "decisions.md"), """
            ## # Bad Heading

            **Date:** 2026-05-01

            Content.
            """);

        var decisions = _service.GetDecisions(_tempDir);

        Assert.Single(decisions);
        Assert.Equal("Bad Heading", decisions[0].Title);
    }
}
