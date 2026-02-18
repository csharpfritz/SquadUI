namespace SquadUI.VS2026;

using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.Extensibility;

/// <summary>
/// Extension entry point for SquadUI in Visual Studio 2026.
/// Uses the out-of-process VisualStudio.Extensibility model.
/// </summary>
[VisualStudioContribution]
internal class Extension : Microsoft.VisualStudio.Extensibility.Extension
{
    /// <inheritdoc />
    public override ExtensionConfiguration ExtensionConfiguration => new()
    {
        Metadata = new(
            id: "SquadUI.VS2026",
            version: this.ExtensionAssemblyVersion,
            publisherName: "csharpfritz",
            displayName: "SquadUI",
            description: "Visualize Squad AI team members and their tasks in Visual Studio"),
    };

    /// <inheritdoc />
    protected override void InitializeServices(IServiceCollection serviceCollection)
    {
        base.InitializeServices(serviceCollection);

        // Future services (TeamMdService, DecisionService, etc.) will be registered here.
    }
}
