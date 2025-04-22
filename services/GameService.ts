// services/GameService.ts
import { get, post } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';

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
    // Get current session to ensure we have a valid token
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    
    const response = await get({
      apiName: 'gamelift-api',
      path: '/games',
      options: {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        }
      }
    }).response;
    
    const data = await response.body.json();
    const games = data as Game[];
    
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
    // Enhanced error logging
    if (error.response) {
      console.error('API response error:', error.response.status, error.response.data);
    } else {
      console.error('API call failed with error:', error.message);
    }
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
    // Get current session to ensure we have a valid token
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    
    const payload = {
      AppIdentifier: appId,
      SGIdentifier: sgId,
      UserId: 'DefaultUser',
      SignalRequest: signalRequest,
      Regions: regions
    };

    const response = await post({
      apiName: 'gamelift-api',
      path: '/',
      options: {
        body: payload,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        }
      }
    }).response;

    const data = await response.body.json();
    return data;
  } catch (error) {
    console.error('Error creating stream session:', error);
    // Enhanced error logging
    if (error.response) {
      console.error('API response error:', error.response.status, error.response.data);
    }
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
    // Get current session to ensure we have a valid token
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    
    const response = await get({
      apiName: 'gamelift-api',
      path: `/session/${encodeURIComponent(sgId)}/${encodeURIComponent(arn)}`,
      options: {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        }
      }
    }).response;

    const data = await response.body.json();
    return data;
  } catch (error) {
    console.error('Error checking session status:', error);
    // Enhanced error logging
    if (error.response) {
      console.error('API response error:', error.response.status, error.response.data);
    }
    throw error;
  }
};
