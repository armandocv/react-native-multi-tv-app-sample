import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { scaledPixels } from '@/hooks/useScale';
import { createStreamSession, getSessionStatus } from '../services/GameService';
import WebView from 'react-native-webview';
import { SpatialNavigationRoot } from 'react-tv-space-navigation';

// Import GameLift Streams SDK for web platform
// Note: For React Native, we'll use a WebView approach for the actual streaming

export default function GamePlayerScreen() {
  const { id, appId, sgId, name, regions } = useLocalSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const [sessionState, setSessionState] = useState({
    status: 'INITIALIZING',
    sessionArn: '',
    region: '',
    error: '',
    signalResponse: '',
  });
  const [pollingTimeout, setPollingTimeout] = useState(false);
  const webViewRef = useRef(null);
  const router = useRouter();
  const styles = useStyles();

  // Parse regions from params
  const parsedRegions = regions ? JSON.parse(String(regions)) : ['us-west-2'];

  useEffect(() => {
    if (isAuthenticated && appId && sgId) {
      startGameSession();
    }
  }, [isAuthenticated, appId, sgId]);

  const startGameSession = async () => {
    try {
      setSessionState({
        status: 'CREATING_SESSION',
        sessionArn: '',
        region: '',
        error: '',
        signalResponse: '',
      });

      // In a real implementation, we would generate the signal request
      // using the GameLift Streams SDK. For now, we'll use a placeholder.
      const signalRequest = JSON.stringify({
        type: 'offer',
        sdp: 'placeholder',
        webSdkVersion: '1.0.0',
      });

      // Create stream session
      try {
        const sessionResponse = await createStreamSession(String(appId), String(sgId), signalRequest, parsedRegions);

        setSessionState((prev) => ({
          ...prev,
          status: 'WAITING_FOR_SESSION',
          sessionArn: sessionResponse.arn,
        }));

        // Poll for session status
        await waitForSessionReady(String(sgId), sessionResponse.arn);
      } catch (error) {
        console.log('Using mock session data for development');
        // For development, simulate a successful session
        setTimeout(() => {
          setSessionState({
            status: 'ACTIVE',
            sessionArn: 'mock-session-arn',
            region: 'us-west-2',
            error: '',
            signalResponse: JSON.stringify({
              type: 'answer',
              sdp: 'mock-sdp',
              webSdkProtocolUrl: 'https://example.com/sdk.js',
            }),
          });
        }, 2000);
      }
    } catch (error) {
      console.error('Error starting game session:', error);
      setSessionState((prev) => ({
        ...prev,
        status: 'ERROR',
        error: 'Failed to start game session',
        signalResponse: '',
      }));
    }
  };

  const waitForSessionReady = async (sgId: string, arn: string, timeoutMs: number = 60000) => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const sessionData = await getSessionStatus(sgId, arn);

        if (sessionData.status === 'ACTIVE') {
          setSessionState((prev) => ({
            ...prev,
            status: 'ACTIVE',
            sessionArn: sessionData.arn,
            region: sessionData.region,
            signalResponse: sessionData.signalResponse,
          }));
          return;
        }

        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Error checking session status:', error);
        setSessionState((prev) => ({
          ...prev,
          status: 'ERROR',
          error: 'Failed to check session status',
          signalResponse: '',
        }));
        return;
      }
    }

    // Timeout reached
    setPollingTimeout(true);
    setSessionState((prev) => ({
      ...prev,
      status: 'ERROR',
      error: 'Timeout waiting for session to be ready',
      signalResponse: '',
    }));
  };

  const handleCloseSession = async () => {
    // In a real implementation, we would close the session via API
    // For now, we'll just navigate back
    router.back();
  };

  if (
    isLoading ||
    sessionState.status === 'INITIALIZING' ||
    sessionState.status === 'CREATING_SESSION' ||
    sessionState.status === 'WAITING_FOR_SESSION'
  ) {
    return (
      <SpatialNavigationRoot>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>
            {isLoading
              ? 'Checking authentication...'
              : sessionState.status === 'CREATING_SESSION'
                ? 'Creating game session...'
                : 'Waiting for session to be ready...'}
          </Text>
        </View>
      </SpatialNavigationRoot>
    );
  }

  if (sessionState.status === 'ERROR') {
    return (
      <SpatialNavigationRoot>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{sessionState.error}</Text>
          {pollingTimeout && (
            <Text style={styles.retryText} onPress={() => startGameSession()}>
              Retry
            </Text>
          )}
          <Text style={styles.backText} onPress={() => router.back()}>
            Go Back
          </Text>
        </View>
      </SpatialNavigationRoot>
    );
  }

  // For web platform, we would directly use the GameLift Streams SDK
  // For mobile/TV platforms, we use a WebView with a custom HTML page that loads the SDK
  return (
    <SpatialNavigationRoot>
      <View style={styles.container}>
        <Text style={styles.title}>{name}</Text>

        {Platform.OS === 'web' ? (
          <View style={styles.gameContainer}>
            {/* Web implementation would use GameLift Streams SDK directly */}
            <Text style={styles.streamText}>Web implementation would use GameLift Streams SDK directly</Text>
            <Text style={styles.streamText}>Session ARN: {sessionState.sessionArn}</Text>
            <Text style={styles.streamText}>Region: {sessionState.region}</Text>
          </View>
        ) : (
          // For development, we'll show a placeholder instead of WebView
          <View style={styles.gameContainer}>
            <Text style={styles.streamText}>Game stream would appear here in a WebView</Text>
            <Text style={styles.streamText}>Session ARN: {sessionState.sessionArn}</Text>
            <Text style={styles.streamText}>Region: {sessionState.region}</Text>
          </View>
          /* In production, you would use WebView:
          <WebView
            ref={webViewRef}
            source={{ uri: 'YOUR_STREAMING_HTML_PAGE_URL' }}
            style={styles.gameContainer}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.webViewLoading}>
                <ActivityIndicator size="large" color="#3498db" />
              </View>
            )}
            onMessage={(event) => {
              // Handle messages from WebView
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'SESSION_ENDED') {
                handleCloseSession();
              }
            }}
            // Pass session data to WebView
            injectedJavaScript={`
              window.SESSION_DATA = {
                sessionArn: "${sessionState.sessionArn}",
                region: "${sessionState.region}",
                appId: "${appId}",
                sgId: "${sgId}",
                signalResponse: ${JSON.stringify(sessionState.signalResponse)}
              };
              true;
            `}
          />
          */
        )}

        <Text style={styles.exitText} onPress={handleCloseSession}>
          Press to exit game
        </Text>
      </View>
    </SpatialNavigationRoot>
  );
}

const useStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#1a1a1a',
      padding: scaledPixels(20),
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#1a1a1a',
    },
    loadingText: {
      color: 'white',
      fontSize: scaledPixels(24),
      marginTop: scaledPixels(20),
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#1a1a1a',
    },
    errorText: {
      color: '#e74c3c',
      fontSize: scaledPixels(24),
      marginBottom: scaledPixels(20),
    },
    backText: {
      color: '#3498db',
      fontSize: scaledPixels(20),
      textDecorationLine: 'underline',
    },
    retryText: {
      color: '#3498db',
      fontSize: scaledPixels(20),
      textDecorationLine: 'underline',
      marginBottom: scaledPixels(20),
    },
    title: {
      fontSize: scaledPixels(36),
      fontWeight: 'bold',
      color: 'white',
      marginBottom: scaledPixels(10),
    },
    gameId: {
      fontSize: scaledPixels(20),
      color: '#cccccc',
      marginBottom: scaledPixels(30),
    },
    gameContainer: {
      flex: 1,
      backgroundColor: '#000000',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: scaledPixels(10),
    },
    webViewLoading: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.7)',
    },
    streamText: {
      color: 'white',
      fontSize: scaledPixels(24),
      textAlign: 'center',
      marginBottom: scaledPixels(10),
    },
    exitText: {
      color: '#e74c3c',
      fontSize: scaledPixels(20),
      textAlign: 'center',
      marginTop: scaledPixels(20),
    },
  });
};
