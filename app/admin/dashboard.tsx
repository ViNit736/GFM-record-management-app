import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { clearSession, getSession } from '../../services/session.service';
import { supabase } from '../../services/supabase';

export default function AdminDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const isXLargeScreen = width >= 1024;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminName, setAdminName] = useState('Admin');
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalFaculty: 0,
    totalCourses: 0,
    pendingVerifications: 0,
    dbStatus: 'Online',
    lastBackup: 'Never'
  });

  useEffect(() => {
    checkAuth();
    loadStats();
  }, []);

  // Removed loadPendingBatches, handleApprove, and handleReject as they were part of the removed batch approval system.


  const checkAuth = async () => {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      router.replace('/');
    } else {
      setAdminName(session.fullName || 'Admin');
    }
  };

  const loadStats = async () => {
    try {
      const { count: studentCount } = await supabase.from('students').select('prn', { count: 'exact', head: true });
      const { count: teacherCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher');
      const { count: courseCount } = await supabase.from('courses_def').select('id', { count: 'exact', head: true });
      const { count: pendingCount } = await supabase.from('students').select('prn', { count: 'exact', head: true }).eq('verification_status', 'Pending');

      setStats({
        totalStudents: studentCount || 0,
        totalFaculty: teacherCount || 0,
        totalCourses: courseCount || 0,
        pendingVerifications: pendingCount || 0,
        dbStatus: 'Online',
        lastBackup: new Date().toLocaleDateString()
      });
    } catch (error) {
      console.error('Error loading admin stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    await clearSession();
    router.replace('/');
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  const quickActions = [
    { id: 'today', title: "Today's Status", subtitle: 'Real-time attendance', icon: 'calendar-outline', color: COLORS.primary, route: '/teacher/dashboard?module=daily-attendance' },
    { id: 'reports', title: 'Attendance History', subtitle: 'View detailed logs', icon: 'stats-chart-outline', color: COLORS.accent, route: '/teacher/dashboard?module=admin-reports' },
    { id: 'add-students', title: 'Add Students', subtitle: 'Register & Import CSV', icon: 'person-add-outline', color: COLORS.secondary, route: '/teacher/dashboard?module=register-student' },
    { id: 'students', title: 'Student Database', subtitle: 'View & verify all', icon: 'people-outline', color: COLORS.secondary, route: '/teacher/dashboard?module=students' },
    { id: 'fees', title: 'Fee Monitoring', subtitle: 'Track fee status', icon: 'card-outline', color: COLORS.accent, route: '/teacher/dashboard?module=fees' },
    { id: 'allocation', title: 'Batch Allocation', subtitle: 'Assign GFMs', icon: 'git-network-outline', color: COLORS.primary, route: '/admin/manage-allocations' },
    { id: 'staff', title: 'Manage Staff', subtitle: 'Faculty & Takers', icon: 'people-circle-outline', color: COLORS.success, route: '/teacher/dashboard?module=manage-staff' },
    { id: 'courses', title: 'Course Config', subtitle: 'Setup semesters', icon: 'book-outline', color: COLORS.accent, route: '/teacher/dashboard?module=courses' },
    { id: 'refresh', title: 'Refresh Stats', subtitle: 'Update dashboard data', icon: 'refresh-outline', color: COLORS.success, action: 'refresh' }
  ];


  const getStatCardWidth = () => {
    if (isXLargeScreen) return (width - 80) / 4 - 12;
    if (isLargeScreen) return (width - 64) / 2 - 8;
    return (width - 52) / 2;
  };

  const getActionCardWidth = () => {
    if (isXLargeScreen) return (width - 80) / 4 - 12;
    if (isLargeScreen) return (width - 64) / 2 - 8;
    return (width - 52) / 2;
  };

  const styles = createStyles(width, isLargeScreen, isXLargeScreen);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerBrand}>
            <View style={styles.logoIcon}><Ionicons name="shield-checkmark" size={isLargeScreen ? 28 : 24} color={COLORS.white} /></View>
            <View>
              <Text style={styles.brandName}>GFM Record</Text>
              <Text style={styles.brandSubtitle}>Admin Control Panel</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color={COLORS.white} />
            {isLargeScreen && <Text style={styles.logoutText}>Logout</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeLabel}>Welcome back,</Text>
          <Text style={styles.adminName}>{adminName}</Text>
          <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { width: getStatCardWidth() }]}>
            <View style={[styles.statIconBg, { backgroundColor: `${COLORS.primary}15` }]}>
              <Ionicons name="people" size={isLargeScreen ? 32 : 28} color={COLORS.primary} />
            </View>
            <Text style={styles.statNumber}>{stats.totalStudents}</Text>
            <Text style={styles.statLabel}>Total Students</Text>
          </View>

          <View style={[styles.statCard, { width: getStatCardWidth() }]}>
            <View style={[styles.statIconBg, { backgroundColor: `${COLORS.secondary}15` }]}>
              <Ionicons name="school" size={isLargeScreen ? 32 : 28} color={COLORS.secondary} />
            </View>
            <Text style={styles.statNumber}>{stats.totalFaculty}</Text>
            <Text style={styles.statLabel}>Total Faculty</Text>
          </View>

          <View style={[styles.statCard, { width: getStatCardWidth() }]}>
            <View style={[styles.statIconBg, { backgroundColor: `${COLORS.accent}15` }]}>
              <Ionicons name="book" size={isLargeScreen ? 32 : 28} color={COLORS.accent} />
            </View>
            <Text style={styles.statNumber}>{stats.totalCourses}</Text>
            <Text style={styles.statLabel}>Active Courses</Text>
          </View>

          <View style={[styles.statCard, { width: getStatCardWidth() }]}>
            <View style={[styles.statIconBg, { backgroundColor: `${COLORS.warning}15` }]}>
              <Ionicons name="time" size={isLargeScreen ? 32 : 28} color={COLORS.warning} />
            </View>
            <Text style={[styles.statNumber, { color: COLORS.warning }]}>{stats.pendingVerifications}</Text>
            <Text style={styles.statLabel}>Pending Verifications</Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <View style={[styles.statusCard, { backgroundColor: `${COLORS.success}10` }]}>
            <Ionicons name="shield-checkmark" size={20} color={COLORS.success} />
            <Text style={[styles.statusText, { color: COLORS.success }]}>Database: {stats.dbStatus}</Text>
          </View>
          <View style={[styles.statusCard, { backgroundColor: `${COLORS.primary}10` }]}>
            <Ionicons name="cloud-done" size={20} color={COLORS.primary} />
            <Text style={[styles.statusText, { color: COLORS.primary }]}>Backup: {stats.lastBackup}</Text>
          </View>
        </View>

        {/* Batch Approvals section removed as per user request to streamline batch assignment */}


        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[styles.actionCard, { width: getActionCardWidth() }]}
                onPress={() => {
                  if (action.action === 'refresh') {
                    onRefresh();
                  } else if (action.route) {
                    router.push(action.route as any);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBg, { backgroundColor: `${action.color}15` }]}>
                  <Ionicons name={action.icon as any} size={isLargeScreen ? 36 : 32} color={action.color} />
                </View>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>GFM Record Management System v2.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (width: number, isLargeScreen: boolean, isXLargeScreen: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: 16, fontSize: 16, color: COLORS.textSecondary },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: isLargeScreen ? 32 : 24,
    paddingHorizontal: isLargeScreen ? 32 : 20
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: isLargeScreen ? 32 : 24 },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoIcon: {
    width: isLargeScreen ? 52 : 44,
    height: isLargeScreen ? 52 : 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  brandName: { fontSize: isLargeScreen ? 24 : 20, fontWeight: 'bold', color: COLORS.white },
  brandSubtitle: { fontSize: isLargeScreen ? 14 : 12, color: 'rgba(255,255,255,0.7)' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: isLargeScreen ? 16 : 12,
    paddingVertical: isLargeScreen ? 12 : 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  logoutText: { color: COLORS.white, fontWeight: '600', fontSize: 14 },
  welcomeSection: { marginTop: 8 },
  welcomeLabel: { fontSize: isLargeScreen ? 16 : 14, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  adminName: { fontSize: isLargeScreen ? 32 : 26, fontWeight: 'bold', color: COLORS.white, marginBottom: 8 },
  dateText: { fontSize: isLargeScreen ? 14 : 13, color: 'rgba(255,255,255,0.7)' },
  scrollContent: { padding: isLargeScreen ? 32 : 20 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
    justifyContent: isXLargeScreen ? 'flex-start' : 'space-between'
  },
  statCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: isLargeScreen ? 24 : 20,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4
  },
  statIconBg: {
    width: isLargeScreen ? 64 : 56,
    height: isLargeScreen ? 64 : 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  statNumber: { fontSize: isLargeScreen ? 32 : 28, fontWeight: 'bold', color: COLORS.text, marginBottom: 4 },
  statLabel: { fontSize: isLargeScreen ? 14 : 13, color: COLORS.textLight, textAlign: 'center' },
  statusRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statusCard: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: isLargeScreen ? 16 : 14, borderRadius: 12, gap: 10 },
  statusText: { fontSize: isLargeScreen ? 14 : 13, fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: isLargeScreen ? 20 : 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 16 },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: isXLargeScreen ? 'flex-start' : 'space-between'
  },
  actionCard: {
    backgroundColor: COLORS.white,
    padding: isLargeScreen ? 24 : 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2
  },
  actionIconBg: {
    width: isLargeScreen ? 72 : 64,
    height: isLargeScreen ? 72 : 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  actionTitle: { fontSize: isLargeScreen ? 16 : 15, fontWeight: '600', color: COLORS.text, marginBottom: 4, textAlign: 'center' },
  actionSubtitle: { fontSize: isLargeScreen ? 13 : 12, color: COLORS.textLight, textAlign: 'center' },
  footer: { alignItems: 'center', paddingVertical: 20 },
  footerText: { fontSize: 12, color: COLORS.textLight },
});
