using SquadUI.VS2026.Core.Services;
using Xunit;

namespace SquadUI.VS2026.Tests;

public class TeamMdServiceTests : IDisposable
{
    private readonly string _tempDir;
    private readonly TeamMdService _service;

    public TeamMdServiceTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), "squadui-tests-" + Guid.NewGuid().ToString("N")[..8]);
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
    public void GetTeamMembers_ReturnsEmpty_WhenFileDoesNotExist()
    {
        var result = _service.GetTeamMembers(Path.Combine(_tempDir, "nonexistent.md"));
        Assert.Empty(result);
    }

    [Fact]
    public void GetTeamMembers_ParsesStandardTeamMd()
    {
        var teamMd = Path.Combine(_tempDir, "team.md");
        File.WriteAllText(teamMd, """
            # Team

            ## Project Context

            **Owner:** TestOwner
            **Repository:** test-repo

            ## Members

            | Name | Role | Charter | Status |
            |------|------|---------|--------|
            | Danny | Lead | `.ai-team/agents/danny/charter.md` | ✅ Active |
            | Rusty | Extension Dev | `.ai-team/agents/rusty/charter.md` | ✅ Active |
            | Linus | Backend Dev | `.ai-team/agents/linus/charter.md` | ✅ Active |
            """);

        var members = _service.GetTeamMembers(teamMd);

        Assert.Equal(3, members.Count);
        Assert.Equal("Danny", members[0].Name);
        Assert.Equal("Lead", members[0].Role);
        Assert.Equal("idle", members[0].Status);
        Assert.Equal("Rusty", members[1].Name);
        Assert.Equal("Extension Dev", members[1].Role);
    }

    [Fact]
    public void ParseContent_HandlesWorkingStatus()
    {
        var content = """
            ## Members

            | Name | Role | Charter | Status |
            |------|------|---------|--------|
            | Alice | Dev | `charter.md` | 🔨 Working |
            | Bob | Tester | `charter.md` | ✅ Active |
            """;

        var members = _service.ParseContent(content);

        Assert.Equal(2, members.Count);
        Assert.Equal("working", members[0].Status);
        Assert.Equal("idle", members[1].Status);
    }

    [Fact]
    public void ParseContent_FallsBackToRosterSection()
    {
        var content = """
            ## Roster

            | Name | Role | Charter | Status |
            |------|------|---------|--------|
            | Danny | Lead | `charter.md` | ✅ Active |
            """;

        var members = _service.ParseContent(content);

        Assert.Single(members);
        Assert.Equal("Danny", members[0].Name);
    }

    [Fact]
    public void ParseContent_SkipsCoordinatorEntries()
    {
        var content = """
            ## Members

            | Name | Role | Charter | Status |
            |------|------|---------|--------|
            | Ralph | Coordinator | `charter.md` | ✅ Active |
            | Danny | Lead | `charter.md` | ✅ Active |
            """;

        var members = _service.ParseContent(content);

        Assert.Single(members);
        Assert.Equal("Danny", members[0].Name);
    }

    [Fact]
    public void ParseContent_IncludesCodingAgentSection()
    {
        var content = """
            ## Members

            | Name | Role | Charter | Status |
            |------|------|---------|--------|
            | Danny | Lead | `charter.md` | ✅ Active |

            ## Coding Agent

            | Name | Role | Charter | Status |
            |------|------|---------|--------|
            | @copilot | Coding Agent | — | 🤖 Coding Agent |
            """;

        var members = _service.ParseContent(content);

        Assert.Equal(2, members.Count);
        Assert.Equal("@copilot", members[1].Name);
        Assert.Equal("Coding Agent", members[1].Role);
    }

    [Fact]
    public void ParseContent_ReturnsEmpty_WhenNoMembersSection()
    {
        var content = """
            # Team

            Some text without any members table.
            """;

        var members = _service.ParseContent(content);
        Assert.Empty(members);
    }

    [Fact]
    public void GetTeamMembers_ParsesFixtureTeamMd()
    {
        // Use the test fixture if available
        var fixturePath = Path.Combine(
            Directory.GetCurrentDirectory(), "..", "..", "..", "..", "..", "..",
            "test-fixtures", ".ai-team", "team.md");

        if (!File.Exists(fixturePath))
        {
            return; // Skip if fixture not found
        }

        var members = _service.GetTeamMembers(fixturePath);
        Assert.True(members.Count >= 3, "Fixture team.md should have at least 3 members");
    }

    [Fact]
    public void ParseContent_HandlesCrlfLineEndings()
    {
        var content = "## Members\r\n\r\n| Name | Role | Charter | Status |\r\n|------|------|---------|--------|\r\n| Danny | Lead | `charter.md` | ✅ Active |\r\n";

        var members = _service.ParseContent(content);

        Assert.Single(members);
        Assert.Equal("Danny", members[0].Name);
    }
}
