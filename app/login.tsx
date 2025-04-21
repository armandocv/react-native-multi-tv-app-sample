import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { scaledPixels } from '@/hooks/useScale';
import { SpatialNavigationFocusableView, SpatialNavigationRoot } from 'react-tv-space-navigation';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const styles = useStyles();

  // If already authenticated, redirect to home
  React.useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  const handleLogin = async () => {
    if (!username || !password) {
      setError('Username and password are required');
      return;
    }

    try {
      setError('');
      await login(username, password);
      // Navigation will happen automatically due to the useEffect above
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login. Please check your credentials.');
    }
  };

  // For development purposes, allow skipping login
  const handleDevLogin = () => {
    console.log('Development login - skipping authentication');
    router.replace('/');
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Authenticating...</Text>
      </View>
    );
  }

  return (
    <SpatialNavigationRoot>
      <View style={styles.container}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>GameLift Streams</Text>
          <Text style={styles.subtitle}>Sign in to access games</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your username"
              placeholderTextColor="#999"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="#999"
              secureTextEntry
            />
          </View>

          <SpatialNavigationFocusableView onSelect={handleLogin}>
            {({ isFocused }) => (
              <TouchableOpacity style={[styles.button, isFocused && styles.buttonFocused]} onPress={handleLogin}>
                <Text style={styles.buttonText}>Sign In</Text>
              </TouchableOpacity>
            )}
          </SpatialNavigationFocusableView>

          {/* Development shortcut */}
          <SpatialNavigationFocusableView onSelect={handleDevLogin}>
            {({ isFocused }) => (
              <TouchableOpacity
                style={[styles.devButton, isFocused && styles.devButtonFocused]}
                onPress={handleDevLogin}
              >
                <Text style={styles.devButtonText}>Development Login (Skip Auth)</Text>
              </TouchableOpacity>
            )}
          </SpatialNavigationFocusableView>
        </View>
      </View>
    </SpatialNavigationRoot>
  );
}

const useStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#1a1a1a',
      padding: scaledPixels(20),
    },
    formContainer: {
      width: Platform.OS === 'web' ? '50%' : '90%',
      maxWidth: scaledPixels(600),
      backgroundColor: '#2c3e50',
      padding: scaledPixels(30),
      borderRadius: scaledPixels(10),
      alignItems: 'center',
    },
    title: {
      fontSize: scaledPixels(36),
      fontWeight: 'bold',
      color: 'white',
      marginBottom: scaledPixels(10),
    },
    subtitle: {
      fontSize: scaledPixels(20),
      color: '#cccccc',
      marginBottom: scaledPixels(30),
    },
    inputContainer: {
      width: '100%',
      marginBottom: scaledPixels(20),
    },
    label: {
      fontSize: scaledPixels(18),
      color: 'white',
      marginBottom: scaledPixels(8),
    },
    input: {
      backgroundColor: '#34495e',
      color: 'white',
      padding: scaledPixels(15),
      borderRadius: scaledPixels(5),
      fontSize: scaledPixels(18),
      width: '100%',
    },
    button: {
      backgroundColor: '#3498db',
      padding: scaledPixels(15),
      borderRadius: scaledPixels(5),
      width: '100%',
      alignItems: 'center',
      marginTop: scaledPixels(20),
    },
    buttonFocused: {
      backgroundColor: '#2980b9',
      transform: [{ scale: 1.05 }],
    },
    buttonText: {
      color: 'white',
      fontSize: scaledPixels(20),
      fontWeight: 'bold',
    },
    devButton: {
      backgroundColor: '#7f8c8d',
      padding: scaledPixels(10),
      borderRadius: scaledPixels(5),
      width: '100%',
      alignItems: 'center',
      marginTop: scaledPixels(20),
    },
    devButtonFocused: {
      backgroundColor: '#95a5a6',
      transform: [{ scale: 1.05 }],
    },
    devButtonText: {
      color: 'white',
      fontSize: scaledPixels(16),
    },
    errorText: {
      color: '#e74c3c',
      fontSize: scaledPixels(18),
      marginBottom: scaledPixels(20),
      textAlign: 'center',
    },
    loadingText: {
      color: 'white',
      fontSize: scaledPixels(24),
      marginTop: scaledPixels(20),
    },
  });
};
