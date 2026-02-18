using System.Text.RegularExpressions;
using SquadUI.VS2026.Core.Models;

namespace SquadUI.VS2026.Core.Services;

/// <summary>
/// Parses decisions from decisions.md and the decisions/ directory.
/// Mirrors the TypeScript DecisionService parsing logic.
/// </summary>
public sealed class DecisionService
{
    private readonly string _squadFolder;

    /// <summary>
    /// Creates a new DecisionService.
    /// </summary>
    /// <param name="squadFolder">Squad folder name (default: ".ai-team").</param>
    public DecisionService(string squadFolder = ".ai-team")
    {
        _squadFolder = squadFolder;
    }

    /// <summary>
    /// Parses decisions from both decisions.md and the decisions/ directory.
    /// Returns decisions in reverse chronological order (newest first).
    /// </summary>
    /// <param name="squadFolderPath">Full path to the squad folder (e.g., workspace/.ai-team).</param>
    /// <returns>Sorted list of decision entries.</returns>
    public List<DecisionEntry> GetDecisions(string squadFolderPath)
    {
        var decisions = new List<DecisionEntry>();

        // Parse canonical decisions.md
        ParseDecisionsMd(squadFolderPath, decisions);

        // Scan individual files in decisions/ directory
        var decisionsDir = Path.Combine(squadFolderPath, "decisions");
        if (Directory.Exists(decisionsDir))
        {
            ScanDirectory(decisionsDir, decisions);
        }

        // Sort by date descending (newest first)
        decisions.Sort((a, b) =>
            string.Compare(b.Date ?? "", a.Date ?? "", StringComparison.Ordinal));

        return decisions;
    }

    // ─── Private Helpers ───────────────────────────────────────────────────

    private void ParseDecisionsMd(string squadFolderPath, List<DecisionEntry> decisions)
    {
        var filePath = Path.Combine(squadFolderPath, "decisions.md");
        if (!File.Exists(filePath))
        {
            return;
        }

        var fileContent = NormalizeEol(File.ReadAllText(filePath));
        var lines = fileContent.Split('\n');

        var subsectionNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "context", "decision", "decisions", "rationale", "impact",
            "alternatives considered", "implementation details", "implementation",
            "members", "alumni", "@copilot", "location", "action required",
            "open questions", "open questions / risks", "related issues",
            "success metrics", "scope decision", "directive",
            "problem statement", "data flow analysis", "root cause",
            "the design gap", "what should happen", "recommended fix",
            "test cases to add", "files to modify", "for linus",
            "implementation phases", "sprint goal", "context & opportunity",
            "work items", "risks & open questions", "next steps", "outcome",
            "success criteria", "vision", "core features", "overview",
            "goals", "non-goals", "assumptions", "constraints",
            "background", "summary", "appendix", "references",
            "changelog", "history", "todo", "notes"
        };

        var i = 0;
        while (i < lines.Length)
        {
            var line = lines[i].Trim();
            var hashMatch = Regex.Match(line, @"^(#+)");
            var hashCount = hashMatch.Success ? hashMatch.Groups[1].Value.Length : 0;

            // H1 "# Decision: {title}" format
            if (hashCount == 1)
            {
                var h1Match = Regex.Match(line, @"^#\s+Decision:\s+(.+)$", RegexOptions.IgnoreCase);
                if (h1Match.Success)
                {
                    var title = h1Match.Groups[1].Value.Trim();
                    string? date = null;
                    string? author = null;

                    var sectionEnd = lines.Length;
                    for (var j = i + 1; j < lines.Length; j++)
                    {
                        var nextLine = lines[j].Trim();
                        if (Regex.IsMatch(nextLine, @"^#\s+") && !nextLine.StartsWith("##"))
                        {
                            sectionEnd = j;
                            break;
                        }
                    }

                    var content = string.Join("\n", lines[i..sectionEnd]);
                    ExtractMetadata(lines, i + 1, Math.Min(i + 20, sectionEnd), ref date, ref author);

                    decisions.Add(new DecisionEntry
                    {
                        Title = title, Date = date, Author = author,
                        Content = content, FilePath = filePath, LineNumber = i
                    });
                    i = sectionEnd;
                    continue;
                }

                i++;
                continue;
            }

            // Match ## or ### headings
            string? headingText = null;
            var isDecisionHeading = false;

            if (hashCount == 2)
            {
                var m = Regex.Match(line, @"^##\s+(.+)$");
                if (m.Success)
                {
                    headingText = m.Groups[1].Value;
                    isDecisionHeading = true;
                }
            }
            else if (hashCount == 3)
            {
                var m = Regex.Match(line, @"^###\s+(.+)$");
                if (m.Success)
                {
                    headingText = m.Groups[1].Value;
                    // ### is only a decision if it starts with a date prefix
                    isDecisionHeading = Regex.IsMatch(headingText.Trim(), @"^\d{4}-\d{2}-\d{2}");
                }
            }

            if (headingText is not null && isDecisionHeading)
            {
                var title = headingText.Trim();

                // Fix malformed headings like "## # Some Title"
                title = Regex.Replace(title, @"^#\s+", "");

                // Extract date from heading prefix
                string? date = null;
                var headingDateMatch = Regex.Match(title, @"^(\d{4}-\d{2}-\d{2})(?:/\d+)?[:/]?\s*");
                if (headingDateMatch.Success)
                {
                    date = headingDateMatch.Groups[1].Value;
                    title = Regex.Replace(title, @"^\d{4}-\d{2}-\d{2}(?:/\d+)?[:/]?\s*", "");
                }

                // Strip prefixes
                title = Regex.Replace(title, @"^User directive\s*[—–\-]\s*", "", RegexOptions.IgnoreCase);
                title = Regex.Replace(title, @"^Decision:\s*", "", RegexOptions.IgnoreCase);

                // Skip generic subsection headings
                if (subsectionNames.Contains(title) ||
                    title.StartsWith("Items deferred", StringComparison.OrdinalIgnoreCase))
                {
                    i++;
                    continue;
                }

                string? author = null;

                // Find end of section
                var sectionEnd = lines.Length;
                for (var j = i + 1; j < lines.Length; j++)
                {
                    var nextLine = lines[j].Trim();
                    var nextHashMatch = Regex.Match(nextLine, @"^(#+)");
                    var nextHash = nextHashMatch.Success ? nextHashMatch.Groups[1].Value.Length : 0;
                    if (nextHash > 0 && nextHash <= hashCount)
                    {
                        sectionEnd = j;
                        break;
                    }
                }

                var content = string.Join("\n", lines[i..sectionEnd]);
                ExtractMetadata(lines, i + 1, Math.Min(i + 20, sectionEnd), ref date, ref author);

                decisions.Add(new DecisionEntry
                {
                    Title = title, Date = date, Author = author,
                    Content = content, FilePath = filePath, LineNumber = i
                });
            }

            i++;
        }
    }

    private static void ExtractMetadata(
        string[] lines, int start, int end,
        ref string? date, ref string? author)
    {
        for (var j = start; j < end; j++)
        {
            var metaLine = lines[j].Trim();

            var dateMatch = Regex.Match(metaLine, @"\*\*Date:\*\*\s*(.+)");
            if (dateMatch.Success)
            {
                var isoMatch = Regex.Match(dateMatch.Groups[1].Value.Trim(), @"(\d{4}-\d{2}-\d{2})");
                if (isoMatch.Success) { date = isoMatch.Groups[1].Value; }
            }

            var authorMatch = Regex.Match(metaLine, @"\*\*Author:\*\*\s*(.+)");
            if (authorMatch.Success) { author = authorMatch.Groups[1].Value.Trim(); }

            var byMatch = Regex.Match(metaLine, @"\*\*By:\*\*\s*(.+)");
            if (byMatch.Success && author is null) { author = byMatch.Groups[1].Value.Trim(); }
        }
    }

    private void ScanDirectory(string dir, List<DecisionEntry> decisions)
    {
        foreach (var entry in Directory.EnumerateFileSystemEntries(dir))
        {
            if (Directory.Exists(entry))
            {
                ScanDirectory(entry, decisions);
            }
            else if (entry.EndsWith(".md", StringComparison.OrdinalIgnoreCase))
            {
                var decision = ParseDecisionFile(entry);
                if (decision is not null)
                {
                    decisions.Add(decision);
                }
            }
        }
    }

    private static DecisionEntry? ParseDecisionFile(string filePath)
    {
        try
        {
            var content = NormalizeEol(File.ReadAllText(filePath));
            var title = "Untitled Decision";
            string? date = null;
            string? author = null;

            // Prefer H1 heading; fall back to H2/H3
            var h1Match = Regex.Match(content, @"^#\s+(?!#)(.+)$", RegexOptions.Multiline);
            var hMatch = h1Match.Success
                ? h1Match
                : Regex.Match(content, @"^###?\s+(.+)$", RegexOptions.Multiline);

            if (hMatch.Success)
            {
                title = hMatch.Groups[1].Value.Trim();

                // Extract date from heading prefix
                var headingDateMatch = Regex.Match(title, @"^(\d{4}-\d{2}-\d{2})(?:/\d+)?[:/]?\s*");
                if (headingDateMatch.Success)
                {
                    date = headingDateMatch.Groups[1].Value;
                    title = Regex.Replace(title, @"^\d{4}-\d{2}-\d{2}(?:/\d+)?[:/]?\s*", "");
                }

                // Strip common prefixes
                title = Regex.Replace(title, @"^User directive\s*[—–\-]\s*", "", RegexOptions.IgnoreCase);
                title = Regex.Replace(title,
                    @"^(?:Design Decision|Decision|Feature Summary|Context|Summary):\s*",
                    "", RegexOptions.IgnoreCase);
            }

            // Extract metadata
            var authorMatch = Regex.Match(content, @"\*\*(?:Author|By):\*\*\s*(.+)$", RegexOptions.Multiline);
            if (authorMatch.Success) { author = authorMatch.Groups[1].Value.Trim(); }

            var dateMatch = Regex.Match(content, @"\*\*Date:\*\*\s*(.+)$", RegexOptions.Multiline);
            if (dateMatch.Success)
            {
                var isoMatch = Regex.Match(dateMatch.Groups[1].Value.Trim(), @"(\d{4}-\d{2}-\d{2})");
                if (isoMatch.Success) { date = isoMatch.Groups[1].Value; }
            }

            // Fall back to file creation time
            if (date is null)
            {
                date = File.GetCreationTime(filePath).ToString("yyyy-MM-dd");
            }

            return new DecisionEntry
            {
                Title = title,
                Author = author,
                Date = date,
                Content = content,
                FilePath = filePath,
                LineNumber = 0
            };
        }
        catch
        {
            return null;
        }
    }

    private static string NormalizeEol(string text) =>
        text.Replace("\r\n", "\n").Replace("\r", "\n");
}
