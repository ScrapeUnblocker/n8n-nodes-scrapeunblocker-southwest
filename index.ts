import { SouthwestAirlinesFlightFaresScraper } from './nodes/SouthwestAirlinesFlightFaresScraper/SouthwestAirlinesFlightFaresScraper.node';
import { ApifyApi } from './credentials/ApifyApi.credentials';

export const nodeTypes = [SouthwestAirlinesFlightFaresScraper];

export const credentialTypes = [ApifyApi];
