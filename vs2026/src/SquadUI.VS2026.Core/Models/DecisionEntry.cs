namespace SquadUI.VS2026.Core.Models;

/// <summary>
/// Represents a single decision parsed from decisions.md or individual decision files.
/// </summary>
public sealed class DecisionEntry
{
    /// <summary>Decision title/heading.</summary>
    public required string Title { get; init; }

    /// <summary>Date of the decision (YYYY-MM-DD), if available.</summary>
    public string? Date { get; init; }

    /// <summary>Who made the decision.</summary>
    public string? Author { get; init; }

    /// <summary>File path to the decisions file for opening.</summary>
    public required string FilePath { get; init; }

    /// <summary>Full markdown content of the decision section.</summary>
    public string? Content { get; init; }

    /// <summary>Line number (0-based) of the heading in the source file.</summary>
    public int? LineNumber { get; init; }
}
