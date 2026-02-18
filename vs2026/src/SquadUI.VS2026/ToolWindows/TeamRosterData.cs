namespace SquadUI.VS2026.ToolWindows;

using System.Collections.ObjectModel;
using System.Runtime.Serialization;
using Microsoft.VisualStudio.Extensibility.UI;
using SquadUI.VS2026.Core.Models;
using SquadUI.VS2026.Core.Services;

/// <summary>
/// Data context for the Team Roster Remote UI control.
/// </summary>
[DataContract]
internal class TeamRosterData : NotifyPropertyChangedObject
{
    private readonly TeamMdService _teamMdService;
    private bool _isLoading;
    private string? _errorMessage;

    public TeamRosterData()
        : this(new TeamMdService())
    {
    }

    public TeamRosterData(TeamMdService teamMdService)
    {
        _teamMdService = teamMdService;
        TeamMembers = new ObservableCollection<TeamMemberViewModel>();
        RefreshCommand = new AsyncCommand(async (_, ct) => await LoadTeamMembersAsync());
    }

    /// <summary>
    /// Observable list of team members displayed in the roster.
    /// </summary>
    [DataMember]
    public ObservableCollection<TeamMemberViewModel> TeamMembers { get; }

    /// <summary>
    /// Indicates whether the roster is currently loading.
    /// </summary>
    [DataMember]
    public bool IsLoading
    {
        get => _isLoading;
        set => SetProperty(ref _isLoading, value);
    }

    /// <summary>
    /// Error message to display when loading fails.
    /// </summary>
    [DataMember]
    public string? ErrorMessage
    {
        get => _errorMessage;
        set => SetProperty(ref _errorMessage, value);
    }

    /// <summary>
    /// Command to refresh the team roster.
    /// </summary>
    [DataMember]
    public AsyncCommand RefreshCommand { get; }

    /// <summary>
    /// Loads team members from the .ai-team/team.md file.
    /// </summary>
    public Task LoadTeamMembersAsync()
    {
        return LoadTeamMembersFromPathAsync(FindTeamMdPath());
    }

    /// <summary>
    /// Loads team members from a specific team.md path. Used for testing.
    /// </summary>
    internal Task LoadTeamMembersFromPathAsync(string? teamMdPath)
    {
        IsLoading = true;
        ErrorMessage = null;

        try
        {
            if (string.IsNullOrEmpty(teamMdPath))
            {
                ErrorMessage = "Could not locate .ai-team/team.md in the workspace.";
                TeamMembers.Clear();
                return Task.CompletedTask;
            }

            var members = _teamMdService.GetTeamMembers(teamMdPath);

            TeamMembers.Clear();
            foreach (var member in members)
            {
                TeamMembers.Add(new TeamMemberViewModel(member));
            }
        }
        catch (Exception ex)
        {
            ErrorMessage = $"Failed to load team roster: {ex.Message}";
            TeamMembers.Clear();
        }
        finally
        {
            IsLoading = false;
        }

        return Task.CompletedTask;
    }

    /// <summary>
    /// Searches for the .ai-team/team.md file by walking up from the current directory.
    /// </summary>
    private static string? FindTeamMdPath()
    {
        var dir = Directory.GetCurrentDirectory();
        while (dir is not null)
        {
            var candidate = Path.Combine(dir, ".ai-team", "team.md");
            if (File.Exists(candidate))
            {
                return candidate;
            }

            dir = Directory.GetParent(dir)?.FullName;
        }

        return null;
    }
}

/// <summary>
/// View model for a single team member row in the roster.
/// </summary>
[DataContract]
internal class TeamMemberViewModel
{
    public TeamMemberViewModel(TeamMember member)
    {
        Name = member.Name;
        Role = member.Role;
        Status = member.Status;
        StatusBadge = member.Status == "working" ? "🔨" : "💤";
    }

    // Parameterless constructor for serialization
    public TeamMemberViewModel() { }

    [DataMember]
    public string Name { get; set; } = string.Empty;

    [DataMember]
    public string Role { get; set; } = string.Empty;

    [DataMember]
    public string Status { get; set; } = "idle";

    [DataMember]
    public string StatusBadge { get; set; } = "💤";
}
