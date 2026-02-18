namespace SquadUI.VS2026.Commands;

using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Commands;
using SquadUI.VS2026.ToolWindows;

/// <summary>
/// Command that opens the Team Roster tool window.
/// </summary>
[VisualStudioContribution]
internal class ShowTeamRosterCommand : Command
{
    /// <inheritdoc />
    public override CommandConfiguration CommandConfiguration => new("%SquadUI.ShowTeamRosterCommand.DisplayName%")
    {
        Placements = [CommandPlacement.KnownPlacements.ExtensionsMenu],
    };

    public ShowTeamRosterCommand(VisualStudioExtensibility extensibility)
        : base(extensibility)
    {
    }

    /// <inheritdoc />
    public override async Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
    {
        await this.Extensibility.Shell().ShowToolWindowAsync<TeamRosterToolWindow>(activate: true, cancellationToken);
    }
}
