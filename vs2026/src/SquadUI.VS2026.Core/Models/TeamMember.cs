namespace SquadUI.VS2026.Core.Models;

/// <summary>
/// Represents a squad member parsed from team.md.
/// </summary>
public sealed class TeamMember
{
    /// <summary>Display name of the member (e.g., "Danny", "Rusty").</summary>
    public required string Name { get; init; }

    /// <summary>Role in the squad (e.g., "Lead", "Extension Dev").</summary>
    public required string Role { get; init; }

    /// <summary>Current working status: "working" or "idle".</summary>
    public string Status { get; init; } = "idle";

    /// <summary>GitHub username, if specified in the Member Aliases table.</summary>
    public string? GitHubUsername { get; set; }

    /// <summary>Short biography or description from the charter.</summary>
    public string? Biography { get; set; }

    /// <summary>Avatar URL or path, if available.</summary>
    public string? Avatar { get; set; }
}
