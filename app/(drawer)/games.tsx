import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { scaledPixels } from '@/hooks/useScale';
import { SpatialNavigationFocusableView } from 'react-tv-space-navigation';

// Mock data for games - replace with actual API call to GameLift
const MOCK_GAMES = [
  {
    id: '1',
    title: 'Space Explorer',
    description: 'Explore the vast universe in this epic space adventure',
    imageUrl: require('@/assets/images/logo.png'),
  },
  {
    id: '2',
    title: 'Racing Legends',
    description: 'High-speed racing with customizable vehicles',
    imageUrl: require('@/assets/images/logo.png'),
  },
  {
    id: '3',
    title: 'Fantasy Quest',
    description: 'Embark on an epic journey through magical realms',
    imageUrl: require('@/assets/images/logo.png'),
  },
  {
    id: '4',
    title: 'Zombie Survival',
    description: 'Survive in a post-apocalyptic world filled with zombies',
    imageUrl: require('@/assets/images/logo.png'),
  },
];

export default function GamesScreen() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [games, setGames] = useState(MOCK_GAMES);
  const styles = useStyles();

  useEffect(() => {
    // Check if user is authenticated
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }

    // Here you would fetch games from GameLift API
    // For now, we're using mock data
  }, [isAuthenticated, isLoading, router]);

  const handleGameSelect = (gameId: string) => {
    // Here you would launch the game using GameLift streams
    console.log(`Starting game: ${gameId}`);
    // Example: router.push(`/game-player?id=${gameId}`);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Games</Text>
      <Text style={styles.subtitle}>Select a game to play via GameLift Streams</Text>

      <FlatList
        data={games}
        numColumns={2}
        contentContainerStyle={styles.gridContainer}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SpatialNavigationFocusableView onSelect={() => handleGameSelect(item.id)}>
            {({ isFocused }) => (
              <View style={[styles.gameCard, isFocused && styles.gameCardFocused]}>
                <Image source={item.imageUrl} style={styles.gameImage} />
                <View style={styles.gameInfo}>
                  <Text style={[styles.gameTitle, isFocused && styles.gameTitleFocused]}>{item.title}</Text>
                  <Text style={[styles.gameDescription, isFocused && styles.gameDescriptionFocused]}>
                    {item.description}
                  </Text>
                  {isFocused && (
                    <View style={styles.playButton}>
                      <Text style={styles.playButtonText}>PLAY NOW</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </SpatialNavigationFocusableView>
        )}
      />
    </View>
  );
}

const useStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: scaledPixels(20),
      backgroundColor: '#1a1a1a',
    },
    title: {
      fontSize: scaledPixels(48),
      fontWeight: 'bold',
      color: 'white',
      marginBottom: scaledPixels(10),
    },
    subtitle: {
      fontSize: scaledPixels(24),
      color: '#cccccc',
      marginBottom: scaledPixels(30),
    },
    loadingText: {
      fontSize: scaledPixels(24),
      color: 'white',
      textAlign: 'center',
      marginTop: scaledPixels(100),
    },
    gridContainer: {
      paddingBottom: scaledPixels(20),
    },
    gameCard: {
      width: scaledPixels(450),
      height: scaledPixels(250),
      backgroundColor: '#2c3e50',
      borderRadius: scaledPixels(10),
      margin: scaledPixels(15),
      overflow: 'hidden',
      flexDirection: 'row',
    },
    gameCardFocused: {
      backgroundColor: '#3498db',
      transform: [{ scale: 1.05 }],
    },
    gameImage: {
      width: scaledPixels(150),
      height: scaledPixels(250),
      resizeMode: 'cover',
    },
    gameInfo: {
      flex: 1,
      padding: scaledPixels(15),
      justifyContent: 'center',
    },
    gameTitle: {
      fontSize: scaledPixels(28),
      fontWeight: 'bold',
      color: 'white',
      marginBottom: scaledPixels(10),
    },
    gameTitleFocused: {
      color: 'white',
    },
    gameDescription: {
      fontSize: scaledPixels(18),
      color: '#cccccc',
    },
    gameDescriptionFocused: {
      color: 'white',
    },
    playButton: {
      backgroundColor: '#e74c3c',
      paddingVertical: scaledPixels(10),
      paddingHorizontal: scaledPixels(20),
      borderRadius: scaledPixels(5),
      alignSelf: 'flex-start',
      marginTop: scaledPixels(15),
    },
    playButtonText: {
      color: 'white',
      fontSize: scaledPixels(18),
      fontWeight: 'bold',
    },
  });
};
