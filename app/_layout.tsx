import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useNavigation } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect } from 'react';

import { MenuProvider } from '../components/MenuContext';
import { GoBackConfiguration } from './remote-control/GoBackConfiguration';
import { AuthProvider } from '../context/AuthContext';
import { Amplify } from 'aws-amplify';
import awsconfig from '../aws-exports';

// Configure Amplify
Amplify.configure(awsconfig);

import './configureRemoteControl';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
      if (error) {
        console.warn(`Error in loading fonts: ${error}`);
      }
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <AuthProvider>
      <MenuProvider>
        <ThemeProvider value={DarkTheme}>
          <GoBackConfiguration />
          <Stack>
            <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
            <Stack.Screen name="details" />
            <Stack.Screen name="player" />
            <Stack.Screen name="login" options={{ headerShown: false }} />
          </Stack>
        </ThemeProvider>
      </MenuProvider>
    </AuthProvider>
  );
}
