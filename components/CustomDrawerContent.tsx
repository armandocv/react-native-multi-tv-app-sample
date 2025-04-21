import { scaledPixels } from '@/hooks/useScale';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { View, StyleSheet, Image, Platform, Text } from 'react-native';
import { DefaultFocus, SpatialNavigationFocusableView, SpatialNavigationRoot } from 'react-tv-space-navigation';
import { useRouter } from 'expo-router';
import { useMenuContext } from '@/components/MenuContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

export default function CustomDrawerContent(props: any) {
  const router = useRouter();
  const { isOpen: isMenuOpen, toggleMenu } = useMenuContext();
  const { isAuthenticated, signOut } = useAuth();
  const styles = useDrawerStyles();
  const { top, right, bottom, left } = useSafeAreaInsets();
  const drawerItems = [
    { name: '/', label: 'Home' },
    { name: 'explore', label: 'Explore' },
    { name: 'tv', label: 'TV' },
    { name: 'games', label: 'Games', requiresAuth: true },
  ];

  return (
    <SpatialNavigationRoot isActive={isMenuOpen}>
      <DrawerContentScrollView
        {...props}
        style={styles.container}
        scrollEnabled={false}
        contentContainerStyle={{
          ...(Platform.OS === 'ios' && Platform.isTV && { paddingStart: 0, paddingEnd: 0, paddingTop: 0 }),
        }}
      >
        <View style={styles.header}>
          <Image source={require('@/assets/images/logo.png')} style={styles.profilePic} />
          <Text style={styles.userName}>Pioneer Tom</Text>
          {isAuthenticated ? (
            <SpatialNavigationFocusableView
              onSelect={() => {
                signOut();
                toggleMenu(false);
              }}
            >
              {({ isFocused }) => (
                <Text style={[styles.switchAccount, isFocused && styles.switchAccountFocused]}>Sign Out</Text>
              )}
            </SpatialNavigationFocusableView>
          ) : (
            <SpatialNavigationFocusableView
              onSelect={() => {
                router.push('/login');
                toggleMenu(false);
              }}
            >
              {({ isFocused }) => (
                <Text style={[styles.switchAccount, isFocused && styles.switchAccountFocused]}>Sign In</Text>
              )}
            </SpatialNavigationFocusableView>
          )}
        </View>
        {drawerItems.map((item, index) => {
          // Skip protected routes if not authenticated
          if (item.requiresAuth && !isAuthenticated) {
            return null;
          }

          return index === 0 ? (
            <DefaultFocus key={index}>
              <SpatialNavigationFocusableView
                onSelect={() => {
                  console.log(item.name);
                  toggleMenu(false);
                  router.push(item.name);
                }}
              >
                {({ isFocused }) => (
                  <View style={[styles.menuItem, isFocused && styles.menuItemFocused]}>
                    <Text style={[styles.menuText, isFocused && styles.menuTextFocused]}>{item.label}</Text>
                  </View>
                )}
              </SpatialNavigationFocusableView>
            </DefaultFocus>
          ) : (
            <SpatialNavigationFocusableView
              key={index}
              onSelect={() => {
                console.log(item.name);
                toggleMenu(false);
                router.push(item.name);
              }}
            >
              {({ isFocused }) => (
                <View style={[styles.menuItem, isFocused && styles.menuItemFocused]}>
                  <Text style={[styles.menuText, isFocused && styles.menuTextFocused]}>{item.label}</Text>
                </View>
              )}
            </SpatialNavigationFocusableView>
          );
        })}
      </DrawerContentScrollView>
    </SpatialNavigationRoot>
  );
}

const useDrawerStyles = function () {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      paddingTop: scaledPixels(20),
    },
    header: {
      padding: scaledPixels(16),
    },
    profilePic: {
      width: scaledPixels(180),
      height: scaledPixels(180),
      borderRadius: scaledPixels(20),
    },
    userName: {
      color: 'white',
      fontSize: scaledPixels(32),
      marginTop: scaledPixels(16),
    },
    switchAccount: {
      color: 'gray',
      fontSize: scaledPixels(20),
    },
    switchAccountFocused: {
      color: '#3498db',
      textDecorationLine: 'underline',
    },
    searchContainer: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      padding: scaledPixels(12),
      marginHorizontal: scaledPixels(16),
      marginVertical: scaledPixels(8),
      borderRadius: scaledPixels(4),
    },
    searchText: {
      color: 'gray',
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: scaledPixels(16),
      paddingBottom: scaledPixels(8),
      paddingStart: scaledPixels(32),
    },
    menuItemFocused: {
      backgroundColor: 'white',
    },
    icon: {
      width: scaledPixels(24),
      height: scaledPixels(24),
      marginRight: scaledPixels(16),
    },
    menuText: {
      color: 'white',
      fontSize: scaledPixels(32),
    },
    menuTextFocused: {
      color: 'black',
    },
  });
};
