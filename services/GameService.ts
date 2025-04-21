// services/GameService.ts
import { API } from 'aws-amplify';

export interface Game {
  sgId: string;
  appId: string;
  name: string;
  description: string;
  preview: string;
  ordering: number;
  regions?: string[];
  staticTile: boolean;
  supportedInputs: string[];
}

export const getGames = async (): Promise<Game[]> => {
  try {
    const response = await API.get('gamelift-api', '/games', {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const games = response as Game[];
    
    // Sort games by ordering and name
    return games.sort((g1, g2) => {
      if (g1.ordering === g2.ordering) {
        return g1.name.localeCompare(g2.name);
      } else {
        return g1.ordering - g2.ordering;
      }
    });
  } catch (error) {
    console.error('Error fetching games:', error);
    throw error;
  }
};

export const createStreamSession = async (
  appId: string, 
  sgId: string, 
  signalRequest: string,
  regions: string[]
): Promise<{ arn: string }> => {
  try {
    const payload = {
      AppIdentifier: appId,
      SGIdentifier: sgId,
      UserId: 'DefaultUser',
      SignalRequest: signalRequest,
      Regions: regions
    };

    const response = await API.post('gamelift-api', '/', {
      body: payload,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return response;
  } catch (error) {
    console.error('Error creating stream session:', error);
    throw error;
  }
};

export const getSessionStatus = async (sgId: string, arn: string): Promise<{
  status: string;
  signalResponse: string;
  arn: string;
  region: string;
}> => {
  try {
    const response = await API.get('gamelift-api', `/session/${encodeURIComponent(sgId)}/${encodeURIComponent(arn)}`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return response;
  } catch (error) {
    console.error('Error checking session status:', error);
    throw error;
  }
};
