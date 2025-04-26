import React, { useEffect, useState, useRef, forwardRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, BackHandler, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { scaledPixels } from '@/hooks/useScale';
import {
  createStreamSession,
  getSessionStatus,
  terminateStreamSession,
  updateStreamSession,
  StreamSession,
} from '../services/GameService';
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
      // Log that the DOM is loaded
      console.log('DOM content loaded');
      
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
      
      // Check if ReactNativeWebView is available
      if (window.ReactNativeWebView) {
        console.log('ReactNativeWebView is available on DOMContentLoaded');
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DOM_LOADED'
        }));
      } else {
        console.error('ReactNativeWebView is NOT available on DOMContentLoaded');
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
    
    // Send a ready message to React Native
    console.log('HTML script executed, checking ReactNativeWebView');
    if (window.ReactNativeWebView) {
      console.log('ReactNativeWebView is available in script');
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'HTML_LOADED'
      }));
    } else {
      console.error('ReactNativeWebView is NOT available in script');
    }
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
      // Initialize the session state
      setSessionState({
        status: 'INITIALIZING',
        sessionArn: '',
        region: '',
        error: '',
        signalResponse: '',
      });

      // For debugging purposes, let's log that we're in this effect
      console.log('Authentication confirmed, appId and sgId available:', { appId, sgId });
      console.log('Waiting for WebView to initialize and generate signal request...');
    }
  }, [isAuthenticated, appId, sgId]);

  // We'll no longer use this function directly
  // Instead, we'll wait for the WebView to generate the signal request first
  const startGameSession = async (signalRequest: string) => {
    try {
      setSessionState({
        status: 'CREATING_SESSION',
        sessionArn: '',
        region: '',
        error: '',
        signalResponse: '',
      });

      console.log(`Starting game session for app ${appId}, group ${sgId} in regions: ${parsedRegions.join(', ')}`);
      console.log('Signal request length:', signalRequest ? signalRequest.length : 0);

      // Create a mock response for testing if needed
      // const mockResponse = {
      //   arn: 'mock-arn-123',
      //   region: 'us-west-2',
      //   status: 'ACTIVE',
      //   signalResponse: '{"mock":"response"}'
      // };

      try {
        // Create a new stream session with the signal request
        console.log('Calling createStreamSession API...');
        const sessionResponse = await createStreamSession(
          String(appId),
          String(sgId),
          signalRequest, // Use the provided signal request
          parsedRegions,
        );

        console.log('Stream session created - Full response:', JSON.stringify(sessionResponse));

        setSessionState((prev) => ({
          ...prev,
          status: 'WAITING_FOR_SESSION',
          sessionArn: sessionResponse.arn,
        }));

        // Wait for the session to be ready
        await waitForSessionReady(String(sgId), sessionResponse.arn);
      } catch (apiError) {
        console.error('API Error starting game session:', apiError);

        // Check if it's a network error
        if (apiError.message && apiError.message.includes('Network request failed')) {
          setSessionState((prev) => ({
            ...prev,
            status: 'ERROR',
            error: 'Network error: Unable to connect to the API. Please check your internet connection.',
          }));
        } else {
          setSessionState((prev) => ({
            ...prev,
            status: 'ERROR',
            error: 'API Error: ' + (apiError.message || 'Unknown API error'),
          }));
        }
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
    console.log(`Waiting for session ${arn} to be ready (timeout: ${timeoutMs}ms)`);

    while (Date.now() - startTime < timeoutMs) {
      try {
        const sessionData = await getSessionStatus(sgId, arn);
        console.log(`Session status: ${sessionData.status}`);
        console.log('Session data:', JSON.stringify(sessionData));

        if (sessionData.status === 'ACTIVE') {
          console.log('Session is active, signal response available:', !!sessionData.signalResponse);

          setSessionState((prev) => ({
            ...prev,
            status: 'ACTIVE',
            sessionArn: sessionData.arn,
            region: sessionData.region || '',
            signalResponse: sessionData.signalResponse || '',
          }));

          // If we have a WebView reference and signal response, process it immediately
          if (webViewRef.current && sessionData.signalResponse) {
            console.log('Processing signal response from session data');
            webViewRef.current.injectJavaScript(`
              try {
                if (window.myGameLiftStreams) {
                  console.log('Processing signal response from session data');
                  window.myGameLiftStreams.processSignalResponse(${JSON.stringify(sessionData.signalResponse)})
                    .then(function() {
                      console.log('Signal response processed successfully');
                      window.myGameLiftStreams.attachInput();
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
                }
              } catch (error) {
                console.error('Error processing signal response:', error);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'STREAM_ERROR',
                  error: 'Failed to process signal response: ' + error.toString()
                }));
              }
              true;
            `);
          }

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
    console.error('Timeout waiting for session to be ready');
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
        case 'HTML_LOADED':
          console.log('HTML content loaded in WebView');
          break;

        case 'DOM_LOADED':
          console.log('DOM content loaded in WebView');
          break;

        case 'SIGNAL_REQUEST':
          console.log('Signal request received from WebView');
          console.log('Signal request length:', data.signalRequest ? data.signalRequest.length : 0);

          // Create a new session with the signal request
          if (!sessionState.sessionArn) {
            console.log('Creating new session with signal request from WebView');
            // Make sure signalRequest is not undefined or empty
            if (!data.signalRequest) {
              console.error('Signal request is empty or undefined');
              setSessionState((prev) => ({
                ...prev,
                status: 'ERROR',
                error: 'Signal request is empty or undefined',
              }));
              return;
            }
            startGameSession(data.signalRequest);
          } else {
            // For existing sessions, we need to update with the signal request
            console.log('Updating existing session with signal request');
            updateStreamSession(String(sgId), sessionState.sessionArn, data.signalRequest)
              .then((response) => {
                console.log('Stream session updated with signal request:', JSON.stringify(response));

                // If the session is already active, we need to pass the signal response back to the WebView
                if (sessionState.status === 'ACTIVE' && response.signalResponse) {
                  console.log('Session is active, processing signal response');
                  webViewRef.current?.injectJavaScript(`
                    try {
                      if (window.myGameLiftStreams) {
                        console.log('Processing signal response after update');
                        window.myGameLiftStreams.processSignalResponse(${JSON.stringify(response.signalResponse)})
                          .then(function() {
                            console.log('Signal response processed successfully');
                            window.myGameLiftStreams.attachInput();
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
                      }
                    } catch (error) {
                      console.error('Error processing signal response:', error);
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'STREAM_ERROR',
                        error: 'Failed to process signal response: ' + error.toString()
                      }));
                    }
                    true;
                  `);
                }
              })
              .catch((error) => {
                console.error('Error updating session with signal request:', error);
                setSessionState((prev) => ({
                  ...prev,
                  status: 'ERROR',
                  error: 'Failed to update session with signal request: ' + (error.message || 'Unknown error'),
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
          if (data.state === 'disconnected') {
            handleCloseSession(true);
          }
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
          <SpatialNavigationFocusableView
            onSelect={() => {
              console.log('Retrying...');
              setSessionState({
                status: 'INITIALIZING',
                sessionArn: '',
                region: '',
                error: '',
                signalResponse: '',
              });
              setSdkLoaded(false);
              // Force reload the SDK
              async function reloadSDK() {
                try {
                  const assetModule = require('../assets/websdk/gameliftstreams-1.0.0.js');
                  const asset = Asset.fromModule(assetModule);
                  await asset.downloadAsync();
                  if (asset.localUri) {
                    const scriptContent = await FileSystem.readAsStringAsync(asset.localUri);
                    setSdkScript(scriptContent);
                    setSdkLoaded(true);
                    console.log('GameLift Streams SDK reloaded successfully');
                  }
                } catch (error) {
                  console.error('Failed to reload SDK:', error);
                }
              }
              reloadSDK();
            }}
          >
            {({ isFocused }) => <Text style={[styles.retryText, isFocused && styles.focusedText]}>Retry</Text>}
          </SpatialNavigationFocusableView>
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
  const [sdkLoaded, setSdkLoaded] = useState(false);

  useEffect(() => {
    async function loadSDKScript() {
      try {
        // Load the SDK script from the assets directory
        console.log('Loading GameLift Streams SDK...');

        // Check if the file exists first
        try {
          const assetModule = require('../assets/websdk/gameliftstreams-1.0.0.js');
          console.log('SDK module found:', assetModule ? 'Yes' : 'No');

          const asset = Asset.fromModule(assetModule);
          console.log('Asset created:', asset ? 'Yes' : 'No');

          await asset.downloadAsync();
          console.log('Asset downloaded successfully');

          if (asset.localUri) {
            console.log('SDK asset found at:', asset.localUri);

            // Try to read the file content
            try {
              const scriptContent = await FileSystem.readAsStringAsync(asset.localUri);
              console.log('SDK script loaded, length:', scriptContent.length);
              console.log('SDK script first 100 chars:', scriptContent.substring(0, 100));

              setSdkScript(scriptContent);
              setSdkLoaded(true);
              console.log('GameLift Streams SDK loaded successfully');
            } catch (readError) {
              console.error('Error reading SDK file:', readError);
              throw readError;
            }
          } else {
            console.error('Failed to load SDK: localUri is undefined');
            setSessionState((prev) => ({
              ...prev,
              status: 'ERROR',
              error: 'Failed to load GameLift Streams SDK: localUri is undefined',
            }));
          }
        } catch (requireError) {
          console.error('Error requiring SDK module:', requireError);

          // Try direct file access as fallback
          console.log('Trying direct file access as fallback...');

          // Check if the file exists using FileSystem
          const sdkPath = FileSystem.documentDirectory + 'gameliftstreams-1.0.0.js';

          // Copy the file from assets to document directory if needed
          await FileSystem.copyAsync({
            from: Asset.fromModule(require('../assets/websdk/gameliftstreams-1.0.0.js')).uri,
            to: sdkPath,
          });

          console.log('SDK copied to:', sdkPath);

          const scriptContent = await FileSystem.readAsStringAsync(sdkPath);
          console.log('SDK script loaded via direct access, length:', scriptContent.length);

          setSdkScript(scriptContent);
          setSdkLoaded(true);
          console.log('GameLift Streams SDK loaded successfully via fallback method');
        }
      } catch (error) {
        console.error('Failed to load SDK script:', error);
        setSessionState((prev) => ({
          ...prev,
          status: 'ERROR',
          error: 'Failed to load GameLift Streams SDK: ' + (error.message || 'Unknown error'),
        }));
      }
    }

    loadSDKScript();
  }, []);

  return (
    <SpatialNavigationRoot>
      <View style={styles.container}>
        {!streamReady && <Text style={styles.title}>{name}</Text>}

        {sessionState.status === 'ACTIVE' && sdkLoaded ? (
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
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('WebView error:', nativeEvent);
              setSessionState((prev) => ({
                ...prev,
                status: 'ERROR',
                error: `WebView error: ${nativeEvent.description || 'Unknown error'}`,
              }));
            }}
            renderLoading={() => (
              <View style={styles.webViewLoading}>
                <ActivityIndicator size="large" color="#3498db" />
                <Text style={styles.loadingText}>Initializing game stream...</Text>
              </View>
            )}
            onMessage={handleWebViewMessage}
            onLoad={() => console.log('WebView loaded successfully')}
            onLoadEnd={() => console.log('WebView load ended')}
            onLoadStart={() => console.log('WebView load started')}
            // Pass session data to WebView
            injectedJavaScript={`
              // Log that the WebView JavaScript is executing
              console.log('WebView injectedJavaScript executing');
              
              // Inject the GameLift Streams SDK directly
              ${sdkScript}
              
              // Log after SDK injection
              console.log('SDK script injected, checking if gameliftstreams is defined');
              console.log('gameliftstreams defined:', typeof gameliftstreams !== 'undefined');
              
              // Initialize the SDK after it's loaded
              try {
                console.log('Initializing GameLift Streams SDK');
                
                // Set log level for debugging
                if (typeof gameliftstreams !== 'undefined') {
                  console.log('GameLift Streams SDK found in global scope');
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
                        updateStatus('Connection state: ' + state);
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
                        updateStatus('Channel error: ' + error);
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'STREAM_ERROR',
                          error: 'WebRTC connection error: ' + error
                        }));
                      },
                      serverDisconnect: function(reason) {
                        console.log('Server disconnected:', reason);
                        updateStatus('Server disconnected: ' + reason);
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
                  console.log('Generating signal request...');
                  gameStreams.generateSignalRequest()
                    .then(function(signalRequest) {
                      console.log('Signal request generated successfully');
                      console.log('Signal request content:', signalRequest.substring(0, 100) + '...');
                      updateStatus('Signal request generated, connecting to stream...');
                      
                      // Send the signal request to React Native
                      console.log('Sending signal request to React Native...');
                      console.log('ReactNativeWebView available:', !!window.ReactNativeWebView);
                      
                      if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'SIGNAL_REQUEST',
                          signalRequest: signalRequest
                        }));
                        console.log('Signal request sent to React Native');
                      } else {
                        console.error('ReactNativeWebView not available');
                        updateStatus('Error: ReactNativeWebView not available');
                      }
                    })
                    .catch(function(error) {
                      console.error('Error generating signal request:', error);
                      updateStatus('Error generating signal request: ' + error.toString());
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'STREAM_ERROR',
                        error: 'Failed to generate signal request: ' + error.toString()
                      }));
                    });
                } else {
                  console.error('GameLift Streams SDK not loaded properly');
                  updateStatus('Error: GameLift Streams SDK not loaded properly');
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'STREAM_ERROR',
                    error: 'GameLift Streams SDK not loaded properly'
                  }));
                }
                
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
                    console.log('Processing signal response from session data');
                    updateStatus('Processing signal response...');
                    
                    gameStreams.processSignalResponse(signalResponse)
                      .then(function() {
                        console.log('Signal response processed successfully');
                        updateStatus('Stream connected successfully');
                        
                        // Attach input after successful connection
                        gameStreams.attachInput();
                        
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'STREAM_READY'
                        }));
                      })
                      .catch(function(error) {
                        console.error('Error processing signal response:', error);
                        updateStatus('Failed to process signal response: ' + error.toString());
                        
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'STREAM_ERROR',
                          error: 'Failed to process signal response: ' + error.toString()
                        }));
                      });
                  } catch (error) {
                    console.error('Error processing signal response:', error);
                    updateStatus('Error processing signal response: ' + error.toString());
                    
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'STREAM_ERROR',
                      error: 'Failed to process signal response: ' + error.toString()
                    }));
                  }
                }
              } catch (error) {
                console.error('Error initializing SDK:', error);
                updateStatus('Error initializing SDK: ' + error.toString());
                
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
                  : !sdkLoaded
                    ? 'Loading GameLift Streams SDK...'
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
