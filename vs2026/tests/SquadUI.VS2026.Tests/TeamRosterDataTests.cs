using SquadUI.VS2026.Core.Services;
using Xunit;

namespace SquadUI.VS2026.Tests;

/// <summary>
/// Tests for the TeamRosterData view model logic.
/// Tests the data context directly without VS Extensibility dependencies.
/// </summary>
public class TeamRosterDataTests : IDisposable
{
    private readonly string _tempDir;
    private readonly TeamMdService _service;

    public TeamRosterDataTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), "squadui-roster-tests-" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(_tempDir);
        _service = new TeamMdService();
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempDir))
        {
            Directory.Delete(_tempDir, recursive: true);
        }
    }

    [Fact]
    public void LoadMembers_PopulatesTeamMembers()
    {
        var teamMdPath = CreateTeamMd("""
            ## Members

            | Name | Role | Charter | Status |
            |------|------|---------|--------|
            | Danny | Lead | `charter.md` | ✅ Active |
            | Rusty | Extension Dev | `charter.md` | 🔨 Working |
            """);

        var members = _service.GetTeamMembers(teamMdPath);

        Assert.Equal(2, members.Count);
        Assert.Equal("Danny", members[0].Name);
        Assert.Equal("Lead", members[0].Role);
        Assert.Equal("idle", members[0].Status);
        Assert.Equal("Rusty", members[1].Name);
        Assert.Equal("Extension Dev", members[1].Role);
        Assert.Equal("working", members[1].Status);
    }

    [Fact]
    public void LoadMembers_ReturnsEmpty_WhenFileNotFound()
    {
        var members = _service.GetTeamMembers(Path.Combine(_tempDir, "nonexistent.md"));

        Assert.Empty(members);
    }

    [Fact]
    public void LoadMembers_HandlesEmptyFile()
    {
        var teamMdPath = CreateTeamMd(string.Empty);

        var members = _service.GetTeamMembers(teamMdPath);

        Assert.Empty(members);
    }

    [Fact]
    public void LoadMembers_HandlesNoMembersSection()
    {
        var teamMdPath = CreateTeamMd("""
            # Team

            Some description without members table.
            """);

        var members = _service.GetTeamMembers(teamMdPath);

        Assert.Empty(members);
    }

    [Fact]
    public void TeamMemberViewModel_SetsWorkingBadge()
    {
        var teamMdPath = CreateTeamMd("""
            ## Members

            | Name | Role | Charter | Status |
            |------|------|---------|--------|
            | Alice | Dev | `charter.md` | 🔨 Working |
            """);

        var members = _service.GetTeamMembers(teamMdPath);

        Assert.Single(members);
        Assert.Equal("working", members[0].Status);
    }

    [Fact]
    public void TeamMemberViewModel_SetsIdleBadge()
    {
        var teamMdPath = CreateTeamMd("""
            ## Members

            | Name | Role | Charter | Status |
            |------|------|---------|--------|
            | Bob | Tester | `charter.md` | ✅ Active |
            """);

        var members = _service.GetTeamMembers(teamMdPath);

        Assert.Single(members);
        Assert.Equal("idle", members[0].Status);
    }

    [Fact]
    public void LoadMembers_ParsesMultipleSections()
    {
        var teamMdPath = CreateTeamMd("""
            ## Members

            | Name | Role | Charter | Status |
            |------|------|---------|--------|
            | Danny | Lead | `charter.md` | ✅ Active |

            ## Coding Agent

            | Name | Role | Charter | Status |
            |------|------|---------|--------|
            | @copilot | Coding Agent | — | 🤖 Coding Agent |
            """);

        var members = _service.GetTeamMembers(teamMdPath);

        Assert.Equal(2, members.Count);
        Assert.Equal("Danny", members[0].Name);
        Assert.Equal("@copilot", members[1].Name);
    }

    private string CreateTeamMd(string content)
    {
        var path = Path.Combine(_tempDir, "team.md");
        File.WriteAllText(path, content);
        return path;
    }
}
