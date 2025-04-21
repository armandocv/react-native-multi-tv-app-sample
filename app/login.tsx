import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { scaledPixels } from '@/hooks/useScale';
import { SpatialNavigationFocusableView, SpatialNavigationRoot } from 'react-tv-space-navigation';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, isLoading } = useAuth();
  const router = useRouter();
  const styles = useStyles();

  const handleLogin = async () => {
    if (!username || !password) {
      return;
    }

    try {
      await signIn(username, password);
      router.replace('/games');
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <SpatialNavigationRoot>
      <View style={styles.container}>
        <View style={styles.loginBox}>
          <Image source={require('@/assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.title}>Sign In</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Username</Text>
            <SpatialNavigationFocusableView onSelect={() => {}}>
              {({ isFocused }) => (
                <TextInput
                  style={[styles.input, isFocused && styles.inputFocused]}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              )}
            </SpatialNavigationFocusableView>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <SpatialNavigationFocusableView onSelect={() => {}}>
              {({ isFocused }) => (
                <TextInput
                  style={[styles.input, isFocused && styles.inputFocused]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              )}
            </SpatialNavigationFocusableView>
          </View>

          <SpatialNavigationFocusableView onSelect={handleLogin}>
            {({ isFocused }) => (
              <View style={[styles.button, isFocused && styles.buttonFocused]}>
                <Text style={[styles.buttonText, isFocused && styles.buttonTextFocused]}>Sign In</Text>
              </View>
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
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#1a1a1a',
    },
    loginBox: {
      width: scaledPixels(600),
      padding: scaledPixels(40),
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderRadius: scaledPixels(10),
      alignItems: 'center',
    },
    logo: {
      width: scaledPixels(150),
      height: scaledPixels(150),
      marginBottom: scaledPixels(30),
    },
    title: {
      fontSize: scaledPixels(36),
      fontWeight: 'bold',
      color: 'white',
      marginBottom: scaledPixels(30),
    },
    inputContainer: {
      width: '100%',
      marginBottom: scaledPixels(20),
    },
    label: {
      fontSize: scaledPixels(20),
      color: 'white',
      marginBottom: scaledPixels(8),
    },
    input: {
      width: '100%',
      height: scaledPixels(60),
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: scaledPixels(5),
      paddingHorizontal: scaledPixels(15),
      fontSize: scaledPixels(20),
      color: 'white',
    },
    inputFocused: {
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      borderWidth: 2,
      borderColor: '#3498db',
    },
    button: {
      width: scaledPixels(200),
      height: scaledPixels(60),
      backgroundColor: '#3498db',
      borderRadius: scaledPixels(5),
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: scaledPixels(20),
    },
    buttonFocused: {
      backgroundColor: '#2980b9',
      transform: [{ scale: 1.05 }],
    },
    buttonText: {
      fontSize: scaledPixels(22),
      fontWeight: 'bold',
      color: 'white',
    },
    buttonTextFocused: {
      color: '#ffffff',
    },
  });
};
