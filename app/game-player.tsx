import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, BackHandler, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { scaledPixels } from '@/hooks/useScale';
import { createStreamSession, getSessionStatus, terminateStreamSession, StreamSession } from '../services/GameService';
import WebView from 'react-native-webview';
import { SpatialNavigationRoot, SpatialNavigationFocusableView } from 'react-tv-space-navigation';
import { Asset } from 'expo-asset';

// HTML content for the streaming client
const HTML_CONTENT = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GameLift Stream</title>
  <style>
    body, html { 
      margin: 0; 
      padding: 0; 
      width: 100%; 
      height: 100%; 
      overflow: hidden; 
      background: #000; 
    }
    video, audio { 
      width: 100%; 
      height: 100%; 
      object-fit: contain; 
    }
    .fullscreen-button { 
      position: absolute; 
      bottom: 20px; 
      right: 20px; 
      z-index: 1002;
      color: white;
      background: rgba(0,0,0,0.5);
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
    }
    .status-overlay {
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(0,0,0,0.5);
      color: white;
      padding: 5px 10px;
      border-radius: 5px;
      font-family: sans-serif;
      font-size: 14px;
      z-index: 1001;
    }
  </style>
</head>
<body>
  <video id="StreamVideoElement" autoplay playsinline></video>
  <audio id="StreamAudioElement" autoplay></audio>
  <div id="statusOverlay" class="status-overlay">Initializing...</div>
  <button id="fullscreenButton" class="fullscreen-button">Fullscreen</button>
  
  <script>
    // Will be populated by injected JavaScript from React Native
    window.SESSION_DATA = {};
    let gameliftstreams = null;
    
    document.addEventListener('DOMContentLoaded', function() {
      // Update status
      updateStatus('Waiting for session data...');
      
      // Setup fullscreen button
      document.getElementById('fullscreenButton').addEventListener('click', function() {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
      });
      
      // Check if we have session data
      if (window.SESSION_DATA && window.SESSION_DATA.signalResponse) {
        initializeStream();
      } else {
        // If no session data yet, wait for it
        updateStatus('No session data available. Waiting...');
      }
    });
    
    // Function to update status overlay
    function updateStatus(message) {
      document.getElementById('statusOverlay').innerText = message;
      console.log('[GameLift Stream]', message);
      
      // Also send to React Native
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'STATUS_UPDATE',
          message: message
        }));
      }
    }
    
    // Initialize the GameLift Streams SDK
    function initializeStream() {
      updateStatus('Initializing GameLift Streams...');
      
      try {
        // In a real implementation, we would use the actual SDK
        // For now, we'll simulate the streaming experience
        updateStatus('SDK initialized. Processing signal response...');
        
        // Process signal response from session
        if (window.SESSION_DATA && window.SESSION_DATA.signalResponse) {
          // Simulate successful connection
          setTimeout(() => {
            updateStatus('Signal response processed. Attaching input...');
            setTimeout(() => {
              updateStatus('Stream ready!');
              
              // Hide status overlay after a few seconds
              setTimeout(() => {
                document.getElementById('statusOverlay').style.opacity = '0';
              }, 3000);
              
              // Notify React Native
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'STREAM_READY'
                }));
              }
            }, 1000);
          }, 1000);
        } else {
          updateStatus('No signal response available');
        }
      } catch (error) {
        updateStatus('Error initializing SDK: ' + error.toString());
        
        // Notify React Native
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'STREAM_ERROR',
            error: error.toString()
          }));
        }
      }
    }
    
    // Generate signal request for session creation
    function generateSignalRequest() {
      try {
        // In a real implementation, we would use the SDK
        // For now, return a mock signal request
        const mockSignalRequest = JSON.stringify({
          type: 'offer',
          sdp: 'mock-sdp-data',
          webSdkVersion: '1.0.0'
        });
        
        // Send signal request to React Native
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'SIGNAL_REQUEST',
            signalRequest: mockSignalRequest
          }));
        }
      } catch (error) {
        updateStatus('Error generating signal request: ' + error.toString());
        
        // Notify React Native
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'STREAM_ERROR',
            error: error.toString()
          }));
        }
      }
    }
    
    // Handle TV remote control input
    function setupTVRemoteControls() {
      document.addEventListener('keydown', function(event) {
        // Map Fire TV remote buttons to appropriate inputs
        switch(event.keyCode) {
          case 37: // Left arrow
            // Already handled by autoKeyboard
            break;
          case 38: // Up arrow
            // Already handled by autoKeyboard
            break;
          case 39: // Right arrow
            // Already handled by autoKeyboard
            break;
          case 40: // Down arrow
            // Already handled by autoKeyboard
            break;
          case 13: // Enter/Select
            // Already handled by autoKeyboard (Enter key)
            break;
          case 27: // Escape/Back
            // Send message to React Native to handle back button
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'BACK_BUTTON_PRESSED'
              }));
            }
            break;
        }
      });
    }
    
    // Connection state callback
    function handleConnectionState(state) {
      updateStatus('Connection state: ' + state);
      
      // Notify React Native
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'CONNECTION_STATE',
          state: state
        }));
      }
      
      if (state === 'disconnected') {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'SESSION_ENDED'
          }));
        }
      }
    }
    
    // Function to close the connection
    function closeConnection() {
      updateStatus('Connection closed');
      
      // Notify React Native
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'SESSION_ENDED'
        }));
      }
    }
    
    // Expose functions to be called from React Native
    window.streamFunctions = {
      initializeStream: initializeStream,
      generateSignalRequest: generateSignalRequest,
      closeConnection: closeConnection
    };
    
    // Setup TV remote controls
    setupTVRemoteControls();
  </script>
</body>
</html>
`;

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
  const [streamReady, setStreamReady] = useState(false);
  const [connectionState, setConnectionState] = useState('');
  const [pollingTimeout, setPollingTimeout] = useState(false);
  const webViewRef = useRef(null);
  const router = useRouter();
  const styles = useStyles();

  // Parse regions from params
  const parsedRegions = regions ? JSON.parse(String(regions)) : ['us-west-2'];

  useEffect(() => {
    // Handle back button on native platforms
    if (Platform.OS !== 'web') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (sessionState.status === 'ACTIVE') {
          handleBackButton();
          return true;
        }
        return false;
      });

      return () => {
        backHandler.remove();
        // Clean up session if component unmounts
        if (sessionState.sessionArn && sessionState.status === 'ACTIVE') {
          handleCloseSession(true);
        }
      };
    } else {
      // For web, add event listener for escape key
      const handleEscKey = (event) => {
        if (event.key === 'Escape' && sessionState.status === 'ACTIVE') {
          handleBackButton();
        }
      };

      window.addEventListener('keydown', handleEscKey);

      return () => {
        window.removeEventListener('keydown', handleEscKey);
        // Clean up session if component unmounts
        if (sessionState.sessionArn && sessionState.status === 'ACTIVE') {
          handleCloseSession(true);
        }
      };
    }
  }, [sessionState.status, sessionState.sessionArn]);

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

      // Generate a placeholder signal request for development
      // In production, this would be generated by the GameLift Streams SDK
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
        console.error('Error creating session:', error);

        // For development, simulate a successful session
        console.log('Using mock session data for development');
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
        error: 'Failed to start game session: ' + (error.message || 'Unknown error'),
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
            region: sessionData.region || '',
            signalResponse: sessionData.signalResponse || '',
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
          error: 'Failed to check session status: ' + (error.message || 'Unknown error'),
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
    }));
  };

  const handleCloseSession = async (skipConfirmation = false) => {
    if (!skipConfirmation) {
      if (Platform.OS !== 'web') {
        Alert.alert('End Game Session', 'Are you sure you want to end this game session?', [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'End Session',
            onPress: async () => {
              try {
                if (sessionState.sessionArn) {
                  // Attempt to terminate the session
                  await terminateStreamSession(String(sgId), sessionState.sessionArn);
                }
              } catch (error) {
                console.error('Error terminating session:', error);
              } finally {
                // Navigate back regardless of termination success
                router.back();
              }
            },
          },
        ]);
      } else {
        // For web, use confirm dialog
        if (window.confirm('Are you sure you want to end this game session?')) {
          try {
            if (sessionState.sessionArn) {
              await terminateStreamSession(String(sgId), sessionState.sessionArn);
            }
          } catch (error) {
            console.error('Error terminating session:', error);
          } finally {
            router.back();
          }
        }
      }
    } else {
      // Skip confirmation and just terminate
      try {
        if (sessionState.sessionArn) {
          await terminateStreamSession(String(sgId), sessionState.sessionArn);
        }
      } catch (error) {
        console.error('Error terminating session:', error);
      } finally {
        if (!skipConfirmation) {
          router.back();
        }
      }
    }
  };

  const handleBackButton = () => {
    handleCloseSession();
    return true;
  };

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      switch (data.type) {
        case 'SIGNAL_REQUEST':
          // Use the signal request to create a session
          createStreamSession(String(appId), String(sgId), data.signalRequest, parsedRegions)
            .then((sessionResponse) => {
              setSessionState((prev) => ({
                ...prev,
                status: 'WAITING_FOR_SESSION',
                sessionArn: sessionResponse.arn,
              }));

              waitForSessionReady(String(sgId), sessionResponse.arn);
            })
            .catch((error) => {
              console.error('Error creating session:', error);
              setSessionState((prev) => ({
                ...prev,
                status: 'ERROR',
                error: 'Failed to create game session: ' + (error.message || 'Unknown error'),
              }));
            });
          break;

        case 'STREAM_READY':
          console.log('Stream is ready');
          setStreamReady(true);
          break;

        case 'STREAM_ERROR':
          console.error('Stream error:', data.error);
          setSessionState((prev) => ({
            ...prev,
            status: 'ERROR',
            error: data.error,
          }));
          break;

        case 'SESSION_ENDED':
          handleCloseSession(true);
          break;

        case 'CONNECTION_STATE':
          setConnectionState(data.state);
          break;

        case 'BACK_BUTTON_PRESSED':
          handleBackButton();
          break;

        case 'STATUS_UPDATE':
          console.log('Stream status:', data.message);
          break;

        default:
          console.log('WebView message:', data);
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
    }
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
            <SpatialNavigationFocusableView onSelect={() => startGameSession()}>
              {({ isFocused }) => <Text style={[styles.retryText, isFocused && styles.focusedText]}>Retry</Text>}
            </SpatialNavigationFocusableView>
          )}
          <SpatialNavigationFocusableView onSelect={() => router.back()}>
            {({ isFocused }) => <Text style={[styles.backText, isFocused && styles.focusedText]}>Go Back</Text>}
          </SpatialNavigationFocusableView>
        </View>
      </SpatialNavigationRoot>
    );
  }

  return (
    <SpatialNavigationRoot>
      <View style={styles.container}>
        {!streamReady && <Text style={styles.title}>{name}</Text>}

        {sessionState.status === 'ACTIVE' && (
          <WebView
            ref={webViewRef}
            source={{ html: HTML_CONTENT }}
            style={styles.gameContainer}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.webViewLoading}>
                <ActivityIndicator size="large" color="#3498db" />
              </View>
            )}
            onMessage={handleWebViewMessage}
            // Pass session data to WebView
            injectedJavaScript={`
              window.SESSION_DATA = {
                sessionArn: "${sessionState.sessionArn}",
                region: "${sessionState.region}",
                appId: "${appId}",
                sgId: "${sgId}",
                signalResponse: ${JSON.stringify(sessionState.signalResponse)}
              };
              
              // Initialize the stream once data is available
              if (window.streamFunctions && window.streamFunctions.initializeStream) {
                window.streamFunctions.initializeStream();
              }
              
              true;
            `}
          />
        )}

        {!streamReady && (
          <SpatialNavigationFocusableView onSelect={() => handleCloseSession()}>
            {({ isFocused }) => (
              <Text style={[styles.exitText, isFocused && styles.focusedText]}>Press to exit game</Text>
            )}
          </SpatialNavigationFocusableView>
        )}
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
      textAlign: 'center',
      padding: scaledPixels(20),
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
    focusedText: {
      color: '#2ecc71',
      transform: [{ scale: 1.1 }],
    },
    title: {
      fontSize: scaledPixels(36),
      fontWeight: 'bold',
      color: 'white',
      marginBottom: scaledPixels(10),
    },
    gameContainer: {
      flex: 1,
      backgroundColor: '#000000',
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
    exitText: {
      color: '#e74c3c',
      fontSize: scaledPixels(20),
      textAlign: 'center',
      marginTop: scaledPixels(20),
    },
  });
};
