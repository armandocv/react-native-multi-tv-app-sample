import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { scaledPixels } from '@/hooks/useScale';

export default function GamePlayerScreen() {
  const { id } = useLocalSearchParams();
  const { isAuthenticated, isLoading } = useProtectedRoute();
  const [gameSession, setGameSession] = useState<any>(null);
  const [loadingGame, setLoadingGame] = useState(true);
  const router = useRouter();
  const styles = useStyles();

  useEffect(() => {
    if (isAuthenticated && id) {
      // Here you would make an API call to GameLift to start a streaming session
      // For now, we'll simulate it with a timeout
      const timer = setTimeout(() => {
        setGameSession({
          id: String(id),
          streamUrl: 'https://example.com/stream',
          status: 'ACTIVE',
        });
        setLoadingGame(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, id]);

  if (isLoading || loadingGame) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>{isLoading ? 'Checking authentication...' : 'Starting game session...'}</Text>
      </View>
    );
  }

  if (!gameSession) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to start game session</Text>
        <Text style={styles.backText} onPress={() => router.back()}>
          Go Back
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Game Session Active</Text>
      <Text style={styles.gameId}>Game ID: {gameSession.id}</Text>

      {/* This is where you would render the actual game stream */}
      <View style={styles.gameContainer}>
        <Text style={styles.streamText}>Game stream would appear here.</Text>
        <Text style={styles.streamText}>In a real implementation, this would connect to GameLift Streams.</Text>
      </View>

      <Text style={styles.exitText} onPress={() => router.back()}>
        Press to exit game
      </Text>
    </View>
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
