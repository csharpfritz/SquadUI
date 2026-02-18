namespace SquadUI.VS2026.ToolWindows;

using Microsoft.VisualStudio.Extensibility.UI;

/// <summary>
/// Remote UI control for the Team Roster tool window.
/// Links the XAML template to the <see cref="TeamRosterData"/> data context.
/// </summary>
internal class TeamRosterControl : RemoteUserControl
{
    public TeamRosterControl(TeamRosterData dataContext)
        : base(dataContext)
    {
    }
}
