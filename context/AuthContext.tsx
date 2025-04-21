import React, { createContext, useContext, useState, useEffect } from 'react';
import { Auth } from 'aws-amplify';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>; // Added signOut as an alias for logout
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  login: async () => {},
  logout: async () => {},
  signOut: async () => {}, // Added signOut as an alias for logout
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      setIsLoading(true);
      const currentUser = await Auth.currentAuthenticatedUser();

      if (currentUser) {
        console.log('User authenticated:', currentUser.username);
        setIsAuthenticated(true);
        setUser({
          username: currentUser.username || 'User',
          email: currentUser.attributes?.email || '',
        });

        // Verify we can get a valid token
        try {
          const session = await Auth.currentSession();
          const token = session.getIdToken().getJwtToken();
          console.log('Valid token obtained');
        } catch (tokenError) {
          console.error('Error getting token:', tokenError);
        }
      } else {
        console.log('No authenticated user found');
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.log('Not authenticated', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      await Auth.signIn(username, password);
      await checkAuthState();
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await Auth.signOut();
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        login,
        logout,
        signOut: logout, // Add signOut as an alias for logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
