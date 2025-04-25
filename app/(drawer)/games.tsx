import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { scaledPixels } from '@/hooks/useScale';
import { SpatialNavigationFocusableView, SpatialNavigationRoot } from 'react-tv-space-navigation';
import { getGames, Game } from '../../services/GameService';

// Fallback mock data in case API fails
const FALLBACK_GAMES = [
  {
    sgId: 'sg-1234567890',
    appId: 'app-1234567890',
    name: 'Space Explorer',
    description: 'Explore the vast universe in this epic space adventure',
    preview: 'space.jpg',
    ordering: 1,
    regions: ['us-west-2'],
    staticTile: false,
    supportedInputs: ['Keyboard', 'Mouse', 'Controller'],
  },
  {
    sgId: 'sg-0987654321',
    appId: 'app-0987654321',
    name: 'Racing Legends',
    description: 'High-speed racing with customizable vehicles',
    preview: 'racing.jpg',
    ordering: 2,
    regions: ['us-west-2'],
    staticTile: false,
    supportedInputs: ['Keyboard', 'Controller'],
  },
  {
    sgId: 'sg-1122334455',
    appId: 'app-1122334455',
    name: 'Fantasy Quest',
    description: 'Embark on an epic journey through a magical realm',
    preview: 'fantasy.jpg',
    ordering: 3,
    regions: ['us-west-2'],
    staticTile: false,
    supportedInputs: ['Keyboard', 'Mouse', 'Controller'],
  },
];

export default function GamesScreen() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRegions, setSelectedRegions] = useState(['us-west-2']); // Default region
  const styles = useStyles();

  useEffect(() => {
    // Check if user is authenticated
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
      return;
    }

    // Fetch games from API
    if (isAuthenticated) {
      fetchGames();
    }
  }, [isAuthenticated, isLoading, router]);

  const fetchGames = async () => {
    try {
      setLoading(true);
      console.log('Fetching games from API...');

      // Try to fetch games from API
      let fetchedGames: Game[];
      try {
        fetchedGames = await getGames();
        console.log('Successfully fetched games:', fetchedGames.length);
        // Print the full JSON object with the list of games
        console.log('Games data:', JSON.stringify(fetchedGames, null, 2));
      } catch (err) {
        console.warn('Failed to fetch games from API, using fallback data:', err);
        Alert.alert('API Error', 'Failed to fetch games from the server. Using fallback data instead.', [
          { text: 'OK' },
        ]);
        fetchedGames = FALLBACK_GAMES;
        // Print the fallback games data as well
        console.log('Fallback games data:', JSON.stringify(fetchedGames, null, 2));
      }

      // Filter games by selected regions
      const filteredGames = fetchedGames.filter((game) => {
        return (
          !game.regions || game.regions.length === 0 || selectedRegions.some((region) => game.regions?.includes(region))
        );
      });

      console.log('Filtered games:', filteredGames.length);
      setGames(filteredGames);
      setError(null);
    } catch (err) {
      console.error('Failed to process games:', err);
      setError('Failed to load games. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGameSelect = (game: Game) => {
    // Navigate directly to game player with game details
    // This is more TV-friendly than showing an Alert which might be hard to navigate with a remote
    console.log(`Starting game: ${game.name}`);

    // Show loading indicator or feedback to user
    Alert.alert('Starting Game', `Launching ${game.name}. Please wait...`, [{ text: 'OK' }]);

    router.push({
      pathname: '/game-player',
      params: {
        id: `${game.appId}|${game.sgId}`,
        appId: game.appId,
        sgId: game.sgId,
        name: game.name,
        regions: JSON.stringify(selectedRegions),
      },
    });
  };

  if (isLoading || loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading games...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.retryText} onPress={fetchGames}>
          Retry
        </Text>
      </View>
    );
  }

  return (
    <SpatialNavigationRoot>
      <View style={styles.container}>
        <Text style={styles.title}>Cloud Gaming</Text>
        <Text style={styles.subtitle}>Select a game to play via GameLift Streams</Text>

        {games.length === 0 ? (
          <Text style={styles.noGamesText}>No games available in the selected regions</Text>
        ) : (
          <FlatList
            data={games}
            numColumns={2}
            contentContainerStyle={styles.gridContainer}
            keyExtractor={(item) => `${item.appId}|${item.sgId}`}
            renderItem={({ item }) => (
              <SpatialNavigationFocusableView
                onSelect={() => handleGameSelect(item)}
                onFocus={() => console.log(`Focused game: ${item.name}`)}
              >
                {({ isFocused }) => (
                  <View style={[styles.gameCard, isFocused && styles.gameCardFocused]}>
                    <Image source={require('@/assets/images/logo.png')} style={styles.gameImage} />
                    <View style={styles.gameInfo}>
                      <Text style={[styles.gameTitle, isFocused && styles.gameTitleFocused]}>{item.name}</Text>
                      <Text
                        style={[styles.gameDescription, isFocused && styles.gameDescriptionFocused]}
                        numberOfLines={2}
                      >
                        {item.description}
                      </Text>
                      <View style={styles.gameDetails}>
                        <Text style={[styles.gameSupport, isFocused && styles.gameSupportFocused]}>
                          Supports: {item.supportedInputs.join(', ')}
                        </Text>
                      </View>
                      {isFocused && (
                        <View style={styles.playButton} onTouchEnd={() => handleGameSelect(item)}>
                          <Text style={styles.playButtonText}>PLAY NOW</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </SpatialNavigationFocusableView>
            )}
          />
        )}
      </View>
    </SpatialNavigationRoot>
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
    errorText: {
      fontSize: scaledPixels(24),
      color: '#e74c3c',
      textAlign: 'center',
      marginTop: scaledPixels(100),
    },
    retryText: {
      fontSize: scaledPixels(20),
      color: '#3498db',
      textAlign: 'center',
      marginTop: scaledPixels(20),
      textDecorationLine: 'underline',
    },
    noGamesText: {
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
      justifyContent: 'space-between',
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
      marginBottom: scaledPixels(10),
    },
    gameDescriptionFocused: {
      color: 'white',
    },
    gameDetails: {
      marginTop: scaledPixels(10),
    },
    gameSupport: {
      fontSize: scaledPixels(14),
      color: '#95a5a6',
    },
    gameSupportFocused: {
      color: '#ecf0f1',
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
