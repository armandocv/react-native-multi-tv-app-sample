// services/GameService.ts
import { get, post } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
// Import the GameLift Streams SDK
import * as gameliftstreamssdk from '../websdk/gameliftstreams-1.0.0';

// Set log level for GameLift Streams SDK
gameliftstreamssdk.setLogLevel('debug');

// GameLift Streams instance
let gameLifStreamsInstance: gameliftstreamssdk.GameLiftStreams | null = null;

/**
 * Initialize the GameLift Streams SDK with video and audio elements
 * This must be called before using any streaming functionality
 * 
 * @param videoElement - The HTML video element to use for streaming
 * @param audioElement - The HTML audio element to use for streaming
 */
export const initializeGameLiftStreams = (videoElement: HTMLVideoElement, audioElement: HTMLAudioElement): void => {
  if (gameLifStreamsInstance) {
    gameLifStreamsInstance.close();
  }
  
  gameLifStreamsInstance = new gameliftstreamssdk.GameLiftStreams({
    videoElement,
    audioElement,
    inputConfiguration: {
      autoMouse: true,
      autoKeyboard: true,
      autoGamepad: true,
      hapticFeedback: true,
      setCursor: 'visibility',
      autoPointerLock: 'fullscreen'
    },
    clientConnection: {
      connectionState: (state: string) => {
        console.log('Connection state:', state);
        if (state === 'disconnected') {
          console.log('Connection disconnected');
        }
      },
      channelError: (error: any) => {
        console.error('WebRTC channel error:', error);
      },
      serverDisconnect: (reasonCode: string) => {
        console.log('Server disconnected with reason:', reasonCode);
      },
      applicationMessage: (message: any) => {
        console.log('Application message received:', message);
      }
    }
  });
  
  console.log('GameLift Streams SDK initialized');
};

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

export enum StreamState {
  STOPPED = 1,
  LOADING,
  RUNNING,
  ERROR
}

export enum Input {
  KEYBOARD = 'Keyboard',
  MOUSE = 'Mouse',
  CONTROLLER = 'Controller',
}

export interface StreamSession {
  arn: string;
  region?: string;
  status?: string;
  signalResponse?: string;
  error?: string;
}

export interface StartStreamRequest {
  AppIdentifier: string;
  SGIdentifier: string;
  UserId: string;
  SignalRequest: string;
  Regions: string[];
}

/**
 * Gets game id based on application id and stream group id.
 */
export function ToGameId(appId: string, sgId: string): string {
  return appId + '|' + sgId;
}

/**
 * Processes a signal response from the server
 * 
 * @param signalResponse - The signal response from the server
 */
export const processSignalResponse = async (signalResponse: string): Promise<void> => {
  if (!gameLifStreamsInstance) {
    throw new Error('GameLift Streams SDK not initialized. Call initializeGameLiftStreams first.');
  }
  await gameLifStreamsInstance.processSignalResponse(signalResponse);
};

/**
 * Fetches the list of available games from the API
 */
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
          'Authorization': `Bearer ${token}`
        }
      }
    }).response;
    
    const data = await response.body.json();
    const games = data as unknown as Game[];
    
    // Sort games by ordering and name
    return games.sort((g1, g2) => {
      if (g1.ordering === g2.ordering) {
        return g1.name.localeCompare(g2.name);
      } else {
        return g1.ordering - g2.ordering;
      }
    });
  } catch (error: any) {
    console.error('Error fetching games:', error);
    if (error.response) {
      console.error('API response error:', error.response.status, error.response.data);
    } else {
      console.error('API call failed with error:', error.message);
    }
    throw error;
  }
};

/**
 * Creates a new stream session using the GameLift Streams API
 * 
 * @param appId - The application identifier
 * @param sgId - The stream group identifier
 * @param regions - Array of AWS regions to try for streaming
 * @returns Promise with the stream session
 */
export const createStreamSession = async (
  appId: string, 
  sgId: string, 
  regions: string[] | string = ['us-west-2']
): Promise<StreamSession> => {
  try {
    // Ensure regions is always an array
    const regionsArray = Array.isArray(regions) ? regions : [regions];
    
    console.log(`Creating stream session for app ${appId}, group ${sgId} in regions: ${regionsArray.join(', ')}`);
    
    // Check if GameLift Streams SDK is initialized
    if (!gameLifStreamsInstance) {
      throw new Error('GameLift Streams SDK not initialized. Call initializeGameLiftStreams first.');
    }
    
    // Generate the signal request using the SDK instance
    const signalRequest = await gameLifStreamsInstance.generateSignalRequest();
    
    // Ensure signalRequest is not null or empty
    if (!signalRequest) {
      throw new Error('Failed to generate SignalRequest');
    }
    
    // Get current session to ensure we have a valid token
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    
    const payload: StartStreamRequest = {
      AppIdentifier: appId,
      SGIdentifier: sgId,
      UserId: 'DefaultUser', // In production, use actual user ID
      SignalRequest: signalRequest,
      Regions: regionsArray
    };

    console.log('Sending request to create stream session');

    try {
      const response = await post({
        apiName: 'gamelift-api',
        path: '/',
        options: {
          body: payload as any,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      }).response;

      const data = await response.body.json();
      console.log('Stream session created successfully');
      return data as unknown as StreamSession;
    } catch (apiError: any) {
      console.error('API error in createStreamSession:', apiError);
      
      // Check if there's a response with error details
      if (apiError.response) {
        try {
          const errorBody = await apiError.response.body.json();
          console.error('API error response body:', JSON.stringify(errorBody));
          throw new Error(`API error: ${errorBody.message || JSON.stringify(errorBody)}`);
        } catch (parseError) {
          console.error('Error parsing API error response:', parseError);
          throw new Error(`API error: ${apiError.message}`);
        }
      }
      
      throw apiError;
    }
  } catch (error: any) {
    console.error('Error creating stream session:', error);
    throw error;
  }
};

/**
 * Polls for the status of a stream session
 * 
 * @param sgId - The stream group identifier
 * @param arn - The session ARN
 * @returns Promise with the session status
 */
export const getSessionStatus = async (sgId: string, arn: string): Promise<StreamSession> => {
  try {
    // Get current session to ensure we have a valid token
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    
    console.log(`Checking status for session ${arn} in group ${sgId}`);
    
    const response = await get({
      apiName: 'gamelift-api',
      path: `/session/${encodeURIComponent(sgId)}/${encodeURIComponent(arn)}`,
      options: {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    }).response;

    const data = await response.body.json();
    return data as unknown as StreamSession;
  } catch (error: any) {
    console.error('Error checking session status:', error);
    if (error.response) {
      console.error('API response error:', error.response.status, error.response.data);
    }
    throw error;
  }
};

/**
 * Updates an existing stream session with a signal request
 * 
 * @param sgId - The stream group identifier
 * @param arn - The session ARN
 * @returns Promise with the update result
 */
export const updateStreamSession = async (
  sgId: string,
  arn: string
): Promise<StreamSession> => {
  try {
    // Check if GameLift Streams SDK is initialized
    if (!gameLifStreamsInstance) {
      throw new Error('GameLift Streams SDK not initialized. Call initializeGameLiftStreams first.');
    }
    
    // Generate a new signal request using the SDK instance
    const signalRequest = await gameLifStreamsInstance.generateSignalRequest();
    
    // Get current session to ensure we have a valid token
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    
    console.log(`Updating stream session ${arn} in group ${sgId}`);
    
    const response = await post({
      apiName: 'gamelift-api',
      path: `/session/${encodeURIComponent(sgId)}/${encodeURIComponent(arn)}/update`,
      options: {
        body: {
          SignalRequest: signalRequest
        } as any,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    }).response;

    const data = await response.body.json();
    console.log('Stream session updated successfully');
    return data as unknown as StreamSession;
  } catch (error: any) {
    console.error('Error updating stream session:', error);
    if (error.response) {
      console.error('API response error:', error.response.status, error.response.data);
    }
    throw error;
  }
};

/**
 * Terminates an active stream session
 * 
 * @param sgId - The stream group identifier
 * @param arn - The session ARN
 * @returns Promise with the termination result
 */
export const terminateStreamSession = async (sgId: string, arn: string): Promise<any> => {
  try {
    // Get current session to ensure we have a valid token
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    
    console.log(`Terminating session ${arn} in group ${sgId}`);
    
    const response = await post({
      apiName: 'gamelift-api',
      path: `/session/${encodeURIComponent(sgId)}/${encodeURIComponent(arn)}/terminate`,
      options: {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    }).response;

    const data = await response.body.json();
    console.log('Session terminated successfully');
    return data;
  } catch (error: any) {
    console.error('Error terminating session:', error);
    if (error.response) {
      console.error('API response error:', error.response.status, error.response.data);
    }
    throw error;
  }
};

/**
 * Waits for a stream session to be ready, polling until it's active or times out
 * 
 * @param arn - The session ARN
 * @param sgId - The stream group identifier
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 10 minutes)
 * @returns Promise that resolves with the session data when the session is active
 */
export const waitForStreamSessionReady = async (
  arn: string, 
  sgId: string,
  timeoutMs: number = 600000
): Promise<StreamSession> => {
  const startTime = Date.now();
  
  console.log(`Waiting for stream session ${arn} to be ready`);
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const sessionData = await getSessionStatus(sgId, arn);
      
      if (sessionData.status === 'ACTIVE' && sessionData.signalResponse) {
        console.log('Stream session is now active');
        return sessionData;
      }
      
      // Wait for 1 second before polling again
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error('Error while waiting for stream session:', error);
      throw error;
    }
  }
  
  // If we reach here, the session timed out
  const timeoutError = `Timeout waiting for stream session: ${arn}`;
  console.error(timeoutError);
  throw new Error(timeoutError);
};
