namespace SquadUI.VS2026.ToolWindows;

using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.ToolWindows;
using Microsoft.VisualStudio.RpcContracts.RemoteUI;

/// <summary>
/// Tool window that displays the Squad team roster.
/// </summary>
[VisualStudioContribution]
internal class TeamRosterToolWindow : ToolWindow
{
    private readonly TeamRosterData _dataContext;

    public TeamRosterToolWindow(VisualStudioExtensibility extensibility)
        : base(extensibility)
    {
        Title = "Squad Team";
        _dataContext = new TeamRosterData();
    }

    /// <inheritdoc />
    public override ToolWindowConfiguration ToolWindowConfiguration => new()
    {
        Placement = ToolWindowPlacement.DocumentWell,
    };

    /// <inheritdoc />
    public override async Task<IRemoteUserControl> GetContentAsync(CancellationToken cancellationToken)
    {
        await _dataContext.LoadTeamMembersAsync();
        return new TeamRosterControl(_dataContext);
    }
}
