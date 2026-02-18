using System.Text.RegularExpressions;
using SquadUI.VS2026.Core.Models;

namespace SquadUI.VS2026.Core.Services;

/// <summary>
/// Parses team.md roster files to extract squad member information.
/// Mirrors the TypeScript TeamMdService parsing logic.
/// </summary>
public sealed class TeamMdService
{
    private static readonly Regex SectionRegex = new(
        @"^##\s+(.+)$", RegexOptions.Multiline | RegexOptions.Compiled);

    /// <summary>
    /// Reads and parses a team.md file, returning the list of team members.
    /// </summary>
    /// <param name="teamMdPath">Full path to the team.md file.</param>
    /// <returns>List of parsed team members, or an empty list if the file doesn't exist.</returns>
    public List<TeamMember> GetTeamMembers(string teamMdPath)
    {
        if (!File.Exists(teamMdPath))
        {
            return [];
        }

        var content = NormalizeEol(File.ReadAllText(teamMdPath));
        return ParseContent(content);
    }

    /// <summary>
    /// Parses team.md content and returns the list of team members.
    /// </summary>
    public List<TeamMember> ParseContent(string content)
    {
        var normalized = NormalizeEol(content);
        var members = new List<TeamMember>();

        // Parse the Members section, falling back to Roster
        var membersSection = ExtractSection(normalized, "Members")
                          ?? ExtractSection(normalized, "Roster");
        if (membersSection is not null)
        {
            members.AddRange(ParseMarkdownTableMembers(membersSection));
        }

        // Also parse the Coding Agent section for @copilot entries
        var codingAgentSection = ExtractSection(normalized, "Coding Agent");
        if (codingAgentSection is not null)
        {
            members.AddRange(ParseMarkdownTableMembers(codingAgentSection));
        }

        return members;
    }

    // ─── Private Helpers ───────────────────────────────────────────────────

    private static List<TeamMember> ParseMarkdownTableMembers(string sectionContent)
    {
        var members = new List<TeamMember>();
        var lines = sectionContent.Split('\n');
        string[]? headers = null;

        foreach (var line in lines)
        {
            var trimmed = line.Trim();
            if (string.IsNullOrEmpty(trimmed) || !trimmed.StartsWith('|'))
            {
                continue;
            }

            var cells = trimmed
                .Split('|', StringSplitOptions.None)
                .Skip(1)                         // remove empty leading segment
                .SkipLast(1)                     // remove empty trailing segment
                .Select(c => c.Trim())
                .ToArray();

            // First table row is the header
            if (headers is null)
            {
                headers = cells.Select(h => h.ToLowerInvariant()).ToArray();
                continue;
            }

            // Skip separator row (|---|---|...)
            if (cells.All(c => Regex.IsMatch(c, @"^[-:]+$")))
            {
                continue;
            }

            var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < Math.Min(headers.Length, cells.Length); i++)
            {
                row[headers[i]] = cells[i];
            }

            var member = ParseTableRow(row);
            if (member is not null)
            {
                members.Add(member);
            }
        }

        return members;
    }

    private static TeamMember? ParseTableRow(Dictionary<string, string> row)
    {
        if (!row.TryGetValue("name", out var name) || string.IsNullOrWhiteSpace(name))
        {
            return null;
        }

        if (!row.TryGetValue("role", out var role) || string.IsNullOrWhiteSpace(role))
        {
            return null;
        }

        // Skip coordinator entries
        if (role.Equals("coordinator", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        row.TryGetValue("status", out var statusText);
        var status = ParseStatusBadge(statusText ?? string.Empty);

        return new TeamMember { Name = name, Role = role, Status = status };
    }

    /// <summary>
    /// Parses status badge text into "working" or "idle".
    /// </summary>
    private static string ParseStatusBadge(string statusText)
    {
        var lower = statusText.ToLowerInvariant();
        if (lower.Contains("working") || lower.Contains("\U0001f528"))
        {
            return "working";
        }

        return "idle";
    }

    /// <summary>
    /// Extracts a ## section's content from markdown.
    /// </summary>
    private static string? ExtractSection(string content, string sectionName)
    {
        var pattern = $@"##\s+{Regex.Escape(sectionName)}\s*\n([\s\S]*?)(?=\n##\s|$)";
        var match = Regex.Match(content, pattern, RegexOptions.IgnoreCase);
        return match.Success ? match.Groups[1].Value.Trim() : null;
    }

    /// <summary>
    /// Normalizes line endings to LF for cross-platform compatibility.
    /// </summary>
    private static string NormalizeEol(string text) =>
        text.Replace("\r\n", "\n").Replace("\r", "\n");
}
