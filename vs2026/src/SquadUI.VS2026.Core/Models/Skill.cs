namespace SquadUI.VS2026.Core.Models;

/// <summary>
/// Represents a skill available for import or already installed.
/// </summary>
public sealed class Skill
{
    /// <summary>Display name of the skill.</summary>
    public required string Name { get; init; }

    /// <summary>URL-safe slug used for filesystem lookup.</summary>
    public string? Slug { get; init; }

    /// <summary>Short description of what the skill does.</summary>
    public required string Description { get; init; }

    /// <summary>URL to the skill's source (GitHub repo, skills.sh page, etc.).</summary>
    public string? SourceUrl { get; init; }
}
