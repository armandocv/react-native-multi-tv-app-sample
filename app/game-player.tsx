import React, { useEffect, useState, useRef, forwardRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, BackHandler, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { scaledPixels } from '@/hooks/useScale';
import { createStreamSession, getSessionStatus, terminateStreamSession, StreamSession } from '../services/GameService';
import WebView from 'react-native-webview';
import { SpatialNavigationRoot, SpatialNavigationFocusableView } from 'react-tv-space-navigation';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

// HTML content for the streaming client - optimized for TV platforms
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
    /* Prevent Safari from drawing media controls over stream */
    video::-webkit-media-controls {
      display: none !important;
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
    #streamFullscreenContainer:not(:fullscreen) > #streamFullscreenOverlay {
      display: none;
    }
    #streamFullscreenContainer:fullscreen > #streamFullscreenOverlay {
      position: absolute;
      left: 0;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 100;
      pointer-events: none;
    }
    #streamFullscreenContainer:fullscreen > #streamVideoElement {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="streamFullscreenContainer">
    <div id="streamFullscreenOverlay">&nbsp;</div>
    <video id="streamVideoElement" autoplay playsinline disablepictureinpicture></video>
    <audio id="streamAudioElement" autoplay></audio>
  </div>
  <div id="statusOverlay" class="status-overlay">Initializing...</div>
  <button id="fullscreenButton" class="fullscreen-button">Fullscreen</button>
  
  <script>
    // Will be populated by injected JavaScript from React Native
    window.SESSION_DATA = {};
    
    document.addEventListener('DOMContentLoaded', function() {
      // Update status
      updateStatus('Waiting for SDK initialization...');
      
      // Setup fullscreen button
      document.getElementById('fullscreenButton').addEventListener('click', function() {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.getElementById('streamFullscreenContainer').requestFullscreen();
        }
      });
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

      // Create a new stream session
      const sessionResponse = await createStreamSession(
        String(appId),
        String(sgId),
        '', // We'll generate the signal request from the WebView
        parsedRegions,
      );

      console.log('Stream session created:', sessionResponse);

      setSessionState((prev) => ({
        ...prev,
        status: 'WAITING_FOR_SESSION',
        sessionArn: sessionResponse.arn,
      }));

      // Wait for the session to be ready
      await waitForSessionReady(String(sgId), sessionResponse.arn);
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
      console.log('WebView message received:', data.type);

      switch (data.type) {
        case 'SIGNAL_REQUEST':
          console.log('Signal request received from WebView');
          // Update the existing session with the signal request
          if (sessionState.sessionArn) {
            updateStreamSession(String(sgId), sessionState.sessionArn, data.signalRequest)
              .then(() => {
                console.log('Stream session updated with signal request');
              })
              .catch((error) => {
                console.error('Error updating session with signal request:', error);
                setSessionState((prev) => ({
                  ...prev,
                  status: 'ERROR',
                  error: 'Failed to update session with signal request: ' + (error.message || 'Unknown error'),
                }));
              });
          } else {
            // Create a new session with the signal request if we don't have one yet
            createStreamSession(String(appId), String(sgId), data.signalRequest, parsedRegions)
              .then((sessionResponse) => {
                console.log('Stream session created successfully:', sessionResponse);
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
          }
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
          console.log('Session ended');
          handleCloseSession(true);
          break;

        case 'SERVER_DISCONNECT':
          console.log('Server disconnected with reason:', data.reason);
          if (data.reason === 'terminated') {
            handleCloseSession(true);
          }
          break;

        case 'CONNECTION_STATE':
          console.log('Connection state changed:', data.state);
          setConnectionState(data.state);
          break;

        case 'BACK_BUTTON_PRESSED':
          console.log('Back button pressed');
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

  // Create a WebView with forwardRef to fix the ref warning
  const CustomWebView = forwardRef((props, ref) => <WebView {...props} ref={ref} />);

  // Prepare the SDK script for injection
  const [sdkScript, setSdkScript] = useState('');

  useEffect(() => {
    async function loadSDKScript() {
      try {
        // Load the SDK script from the assets directory
        const scriptPath = FileSystem.documentDirectory + 'gameliftstreams-1.0.0.js';
        const assetModule = require('../assets/websdk/gameliftstreams-1.0.0.js');
        const asset = Asset.fromModule(assetModule);
        await asset.downloadAsync();

        if (asset.localUri) {
          const scriptContent = await FileSystem.readAsStringAsync(asset.localUri);
          setSdkScript(scriptContent);
        }
      } catch (error) {
        console.error('Failed to load SDK script:', error);
      }
    }

    loadSDKScript();
  }, []);

  return (
    <SpatialNavigationRoot>
      <View style={styles.container}>
        {!streamReady && <Text style={styles.title}>{name}</Text>}

        {sessionState.status === 'ACTIVE' ? (
          <CustomWebView
            ref={webViewRef}
            source={{ html: HTML_CONTENT }}
            style={styles.gameContainer}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            startInLoadingState={true}
            originWhitelist={['*']}
            renderLoading={() => (
              <View style={styles.webViewLoading}>
                <ActivityIndicator size="large" color="#3498db" />
              </View>
            )}
            onMessage={handleWebViewMessage}
            // Pass session data to WebView
            injectedJavaScript={`
              // Inject the GameLift Streams SDK directly
              ${sdkScript}
              
              // Initialize the SDK after it's loaded
              try {
                console.log('Initializing GameLift Streams SDK');
                
                // Set log level for debugging
                gameliftstreams.setLogLevel('debug');
                
                // Create GameLiftStreams instance
                const gameStreams = new gameliftstreams.GameLiftStreams({
                  videoElement: document.getElementById('streamVideoElement'),
                  audioElement: document.getElementById('streamAudioElement'),
                  inputConfiguration: {
                    autoMouse: true,
                    autoKeyboard: true,
                    autoGamepad: true,
                    hapticFeedback: true,
                    setCursor: 'visibility',
                    autoPointerLock: 'fullscreen',
                  },
                  clientConnection: {
                    connectionState: function(state) {
                      console.log('Connection state:', state);
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'CONNECTION_STATE',
                        state: state
                      }));
                      
                      if (state === 'disconnected') {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'SESSION_ENDED'
                        }));
                      }
                    },
                    channelError: function(error) {
                      console.error('Channel error:', error);
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'STREAM_ERROR',
                        error: 'WebRTC connection error: ' + error
                      }));
                    },
                    serverDisconnect: function(reason) {
                      console.log('Server disconnected:', reason);
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'SERVER_DISCONNECT',
                        reason: reason
                      }));
                    },
                    applicationMessage: function(message) {
                      console.log('Application message received, length:', message.length);
                    }
                  }
                });
                
                // Store the instance globally
                window.myGameLiftStreams = gameStreams;
                
                // Generate signal request
                gameStreams.generateSignalRequest()
                  .then(function(signalRequest) {
                    console.log('Signal request generated successfully');
                    
                    // Send the signal request to React Native
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'SIGNAL_REQUEST',
                      signalRequest: signalRequest
                    }));
                  })
                  .catch(function(error) {
                    console.error('Error generating signal request:', error);
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'STREAM_ERROR',
                      error: 'Failed to generate signal request: ' + error.toString()
                    }));
                  });
                
                // Set session data
                window.SESSION_DATA = {
                  sessionArn: "${sessionState.sessionArn}",
                  region: "${sessionState.region}",
                  appId: "${appId}",
                  sgId: "${sgId}",
                  signalResponse: ${JSON.stringify(sessionState.signalResponse)}
                };
                
                // Process signal response if available
                if (window.SESSION_DATA && window.SESSION_DATA.signalResponse) {
                  try {
                    const signalResponse = window.SESSION_DATA.signalResponse;
                    gameStreams.processSignalResponse(signalResponse)
                      .then(function() {
                        console.log('Signal response processed successfully');
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'STREAM_READY'
                        }));
                      })
                      .catch(function(error) {
                        console.error('Error processing signal response:', error);
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'STREAM_ERROR',
                          error: 'Failed to process signal response: ' + error.toString()
                        }));
                      });
                  } catch (error) {
                    console.error('Error processing signal response:', error);
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'STREAM_ERROR',
                      error: 'Failed to process signal response: ' + error.toString()
                    }));
                  }
                }
              } catch (error) {
                console.error('Error initializing SDK:', error);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'STREAM_ERROR',
                  error: 'Failed to initialize SDK: ' + error.toString()
                }));
              }
              
              true;
            `}
          />
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3498db" />
            <Text style={styles.loadingText}>
              {sessionState.status === 'CREATING_SESSION'
                ? 'Initializing game session...'
                : sessionState.status === 'WAITING_FOR_SESSION'
                  ? 'Waiting for session to be ready...'
                  : 'Preparing stream...'}
            </Text>
          </View>
        )}

        {!streamReady && sessionState.status === 'ACTIVE' && (
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
