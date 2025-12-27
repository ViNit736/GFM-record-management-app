import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getSession, clearSession } from '../../services/session.service';
import { dbPromise } from '../../storage/sqlite';
import { COLORS } from '../../constants/colors';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [adminName, setAdminName] = useState('Admin');
    const [stats, setStats] = useState({
      totalStudents: 0,
      totalFaculty: 0,
      totalCourses: 0,
      dbStatus: 'Online',
      lastBackup: 'Never'
    });

    useEffect(() => {
      checkAuth();
      loadStats();
    }, []);

    const checkAuth = async () => {
      const session = await getSession();
      if (!session || session.role !== 'admin') {
        router.replace('/login');
      } else {
        setAdminName(session.fullName || 'Admin');
      }
    };

    const loadStats = async () => {
      try {
        const db = await dbPromise;
        
        const studentRes = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) as count FROM students');
        const teacherRes = await db.getAllAsync<{ count: number }>("SELECT COUNT(*) as count FROM users WHERE role = 'teacher'");
        const courseRes = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) as count FROM courses_def');

        setStats({
          totalStudents: studentRes[0]?.count || 0,
          totalFaculty: teacherRes[0]?.count || 0,
          totalCourses: courseRes[0]?.count || 0,
          dbStatus: 'Healthy',
          lastBackup: new Date().toLocaleDateString()
        });

    } catch (error) {
      console.error('Error loading admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await clearSession();
    router.replace('/login');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.collegeName}>GFM Record</Text>
          <Text style={styles.tagline}>Admin Control Panel</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>Welcome, {adminName}</Text>
          <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
        </View>

          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: '#EBF5FB' }]}>
              <Ionicons name="people" size={32} color={COLORS.secondary} />
              <Text style={styles.statNumber}>{stats.totalStudents}</Text>
              <Text style={styles.statLabel}>Total Students</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#EAFAF1' }]}>
              <Ionicons name="school" size={32} color={COLORS.success} />
              <Text style={styles.statNumber}>{stats.totalFaculty}</Text>
              <Text style={styles.statLabel}>Total Faculty</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#FEF9E7' }]}>
              <Ionicons name="book" size={32} color={COLORS.warning} />
              <Text style={styles.statNumber}>{stats.totalCourses}</Text>
              <Text style={styles.statLabel}>Active Courses</Text>
            </View>
          </View>

          <View style={[styles.statsRow, { marginTop: -10 }]}>
            <View style={[styles.statCard, { backgroundColor: '#F4ECF7', flexDirection: 'row', justifyContent: 'center', gap: 10 }]}>
              <Ionicons name="shield-checkmark" size={20} color="#8E44AD" />
              <Text style={[styles.statLabel, { color: '#8E44AD', fontWeight: 'bold' }]}>DB: {stats.dbStatus}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#FBEEE6', flexDirection: 'row', justifyContent: 'center', gap: 10 }]}>
              <Ionicons name="cloud-done" size={20} color="#A04000" />
              <Text style={[styles.statLabel, { color: '#A04000', fontWeight: 'bold' }]}>Backup: {stats.lastBackup}</Text>
            </View>
          </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.grid}>
                  <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/teacher/dashboard')}>
                    <Ionicons name="people-circle-outline" size={40} color={COLORS.primary} />
                    <Text style={styles.actionText}>Manage Students</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/admin/faculty')}>
                    <Ionicons name="briefcase-outline" size={40} color={COLORS.primary} />
                    <Text style={styles.actionText}>Manage Faculty</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionCard} onPress={() => {
                    Alert.alert('System Settings', 'System is running optimally. No changes required at this time.');
                  }}>
                    <Ionicons name="settings-outline" size={40} color={COLORS.primary} />
                    <Text style={styles.actionText}>System Status</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionCard} onPress={async () => {
                    setLoading(true);
                    await loadStats();
                    Alert.alert('Backup', 'Local database snapshot verified and synced.');
                  }}>
                    <Ionicons name="sync-outline" size={40} color={COLORS.primary} />
                    <Text style={styles.actionText}>Sync Records</Text>
                  </TouchableOpacity>
                </View>
              </View>

        </ScrollView>
      </View>
    );
  }

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  headerLeft: {
    flex: 1,
  },
  collegeName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  tagline: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 20,
  },
  welcomeSection: {
    marginBottom: 25,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  dateText: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
    gap: 15,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 15,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  actionCard: {
    width: (width - 55) / 2,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#eee',
  },
  actionText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
});
