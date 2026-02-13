/**
 * Service layer exports for SquadUI.
 */

export { OrchestrationLogService } from './OrchestrationLogService';
export {
    FileWatcherService,
    type FileWatcherEvent,
    type FileWatcherEventType,
    type FileWatcherCallback,
    type CacheInvalidator
} from './FileWatcherService';
export { SquadDataProvider } from './SquadDataProvider';
export {
    TeamMdService,
    type CopilotCapabilities,
    type ExtendedTeamRoster
} from './TeamMdService';
export {
    GitHubIssuesService,
    type GitHubIssuesServiceOptions
} from './GitHubIssuesService';
