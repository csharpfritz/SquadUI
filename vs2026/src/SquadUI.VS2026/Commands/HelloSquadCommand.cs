namespace SquadUI.VS2026.Commands;

using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Commands;
using Microsoft.VisualStudio.Extensibility.Shell;

/// <summary>
/// Verification command that displays a greeting prompt.
/// This confirms the extension loaded and command registration is working.
/// </summary>
[VisualStudioContribution]
internal class HelloSquadCommand : Command
{
    /// <inheritdoc />
    public override CommandConfiguration CommandConfiguration => new("%SquadUI.HelloSquadCommand.DisplayName%")
    {
        Placements = [CommandPlacement.KnownPlacements.ExtensionsMenu],
    };

    public HelloSquadCommand(VisualStudioExtensibility extensibility)
        : base(extensibility)
    {
    }

    /// <inheritdoc />
    public override async Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
    {
        await this.Extensibility.Shell().ShowPromptAsync(
            "Hello from SquadUI! 🤖 Your AI team extension is running.",
            PromptOptions.OK,
            cancellationToken);
    }
}
