import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { initDB } from '../storage/sqlite'; 
import { getSession } from '../services/session.service';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();
  const segments = useSegments() as string[];
  const isNavigating = useRef(false);

  const [dbInitialized, setDbInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await initDB();
        setDbInitialized(true);
      } catch (error) {
        console.error('DB Init Error:', error);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!dbInitialized) return;

    let isMounted = true;
    const checkAuth = async () => {
      try {
        const session = await getSession();
        if (!isMounted) return;

        const firstSegment = segments[0];
        const isAuthRoute = 
          firstSegment === 'login' || 
          firstSegment === 'signup' || 
          !firstSegment;

        let destination: string | null = null;

        if (!session) {
          if (!isAuthRoute) {
            destination = '/';
          }
        } else {
          if (isAuthRoute) {
            if (session.role === 'admin') {
              destination = '/admin/dashboard';
            } else if (session.role === 'teacher') {
              destination = '/teacher/dashboard';
            } else {
              destination = '/student/dashboard';
            }
          }
        }

        if (destination && !isNavigating.current) {
          const currentPath = '/' + segments.join('/');
          // Normalize both paths to avoid false mismatches
          const normalizedPath = currentPath.replace(/\/+$/, '') || '/';
          const normalizedDest = destination.replace(/\/+$/, '') || '/';

          if (normalizedPath !== normalizedDest) {
            isNavigating.current = true;
            console.log(`[AuthGuard] Redirecting from ${normalizedPath} to ${normalizedDest}`);
            router.replace(normalizedDest as any);
            setTimeout(() => {
              isNavigating.current = false;
            }, 1000);
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    };

    checkAuth();
    return () => { isMounted = false; };
  }, [segments, dbInitialized]);



  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return <Slot />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa'
  }
});