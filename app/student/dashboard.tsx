import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { ChangePasswordModal } from '../../components/ChangePasswordModal';
import { ProfileMenu } from '../../components/common/ProfileMenu';
import { COLORS } from '../../constants/colors';
import { getFullYearName } from '../../constants/Mappings';
import { logout } from '../../services/auth.service';
import { populateTemplate } from '../../services/pdf-template.service';
import { getSession, saveSession } from '../../services/session.service';
import {
  getAcademicRecordsByStudent,
  getAchievements,
  getFeePayments,
  getInternships,
  getStudentActivities,
  getStudentInfo,
  Student
} from '../../storage/sqlite';
import { generatePDF } from '../../utils/pdf-generator';

const isWeb = Platform.OS === 'web';
const LOGO_LEFT_IMG = require('../../assets/images/left.png');
const LOGO_RIGHT_IMG = require('../../assets/images/right.png');
const FALLBACK_LOGO = require('../../assets/images/icon.png');

const getBase64Image = (source: any, timeout = 5000): Promise<string> => {
  return new Promise((resolve) => {
    try {
      if (!source) return resolve('');

      let url = '';
      if (typeof source === 'string') {
        url = source;
      } else {
        // Robust asset resolution
        try {
          const resolved = Image.resolveAssetSource ? Image.resolveAssetSource(source) : null;
          url = resolved?.uri || '';
          if (!url && typeof source === 'object' && source?.uri) {
            url = source.uri;
          }
        } catch (e) {
          url = '';
        }
      }

      if (!url) return resolve('');
      if (typeof url === 'string' && url.startsWith('data:')) return resolve(url);

      if (!isWeb || typeof window === 'undefined') {
        return resolve(url);
      }

      const img = document.createElement('img');
      img.setAttribute('crossOrigin', 'anonymous');
      const timer = setTimeout(() => { img.src = ""; resolve(url || ''); }, timeout);
      img.onload = () => {
        clearTimeout(timer);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        try { resolve(canvas.toDataURL('image/png')); } catch (e) { resolve(url || ''); }
      };
      img.onerror = () => { clearTimeout(timer); resolve(url?.includes('supabase.co') ? FALLBACK_LOGO : (url || '')); };
      img.src = url;
    } catch (e) {
      console.warn('getBase64Image error:', e);
      resolve('');
    }
  });
};

const createStyles = (width: number, isLargeScreen: boolean, isXLargeScreen: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 25,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  headerLogo: {
    width: '100%',
    height: '100%',
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  profileIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    position: 'relative',
    overflow: 'visible',
  },
  headerAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  headerAvatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  welcomeSection: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  studentName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    maxWidth: width * 0.6,
  },
  prnContainer: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
  },
  prnLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  prnValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  statIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: 'bold',
  },
  modulesSection: {
    padding: 24,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  moduleIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  moduleCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  moduleChevron: {
    position: 'absolute',
    top: 12,
    right: 12,
    opacity: 0.3,
  },
  footer: {
    padding: 32,
    alignItems: 'center',
    opacity: 0.6,
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  loadingContent: { alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#64748B', fontWeight: '500' },
  errorContainer: { flex: 1, backgroundColor: '#F8FAFC', padding: 24, justifyContent: 'center' },
  errorContent: { alignItems: 'center' },
  errorIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: `${COLORS.primary}10`, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  errorTitle: { fontSize: 22, fontWeight: 'bold', color: '#1E293B', marginBottom: 8 },
  errorText: { fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, gap: 10 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  modalContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalCloseBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  modalTabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingBottom: 16, gap: 10 },
  modalTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#F1F5F9', gap: 6 },
  modalTabActive: { backgroundColor: `${COLORS.primary}10` },
  modalTabText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  modalTabTextActive: { color: COLORS.primary },
  modalContent: { flex: 1 },
  modalProfileHeader: { alignItems: 'center', paddingVertical: 30, backgroundColor: '#FFFFFF', marginBottom: 12 },
  modalProfileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: `${COLORS.primary}10`,
    marginBottom: 15
  },
  modalProfileName: { fontSize: 22, fontWeight: 'bold', color: '#1E293B', marginBottom: 4 },
  modalProfilePrn: { fontSize: 14, color: '#64748B', marginBottom: 15 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, gap: 6 },
  verifiedBadge: { backgroundColor: '#DCFCE7' },
  rejectedBadge: { backgroundColor: '#FEE2E2' },
  pendingBadge: { backgroundColor: '#FEF3C7' },
  statusText: { fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase' },
  templateContainer: { padding: 24 },
  templateLoading: { alignItems: 'center', paddingVertical: 80 },
  templateLoadingText: { marginTop: 16, fontSize: 15, color: COLORS.textSecondary, fontWeight: '500' },
  templatePlaceholder: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 40 },
  templatePlaceholderText: { fontSize: 15, color: COLORS.textLight, textAlign: 'center', lineHeight: 22 },
  modalFooter: {
    flexDirection: 'row',
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  footerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 14,
    gap: 8,
  },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  secondaryBtnText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  incompleteOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  incompleteCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center' },
  incompleteIcon: { marginBottom: 16 },
  incompleteTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E293B', marginBottom: 8 },
  incompleteSubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 20 },
  missingList: { width: '100%', maxHeight: 200, marginBottom: 24 },
  missingItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10, paddingHorizontal: 12 },
  missingText: { fontSize: 14, color: '#475569' },
  completeBtn: { width: '100%', height: 54, borderRadius: 16, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  completeBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});

export default function StudentDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const isXLargeScreen = width >= 1024;

  const [profile, setProfile] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [templateLoading, setTemplateLoading] = useState(false);
  const [incompleteModalVisible, setIncompleteModalVisible] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [viewMode, setViewMode] = useState<'details' | 'template'>('details');

  const checkAuth = async () => {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      router.replace('/');
      return null;
    }
    setUserEmail(session.email || '');
    setUserPassword(session.password || '');
    return session;
  };

  const checkProfileCompletion = (data: Student): string[] => {
    const requiredFields = [
      { key: 'fullName', label: 'Full Name' },
      { key: 'gender', label: 'Gender' },
      { key: 'dob', label: 'Date of Birth' },
      { key: 'phone', label: 'Phone Number' },
      { key: 'email', label: 'Email' },
      { key: 'permanentAddress', label: 'Permanent Address' },
      { key: 'fatherName', label: 'Father/Guardian Name' },
      { key: 'branch', label: 'Branch' },
      { key: 'yearOfStudy', label: 'Year of Study' },
      { key: 'division', label: 'Division' },
    ];
    const missing: string[] = [];
    requiredFields.forEach(field => {
      const value = (data as any)[field.key];
      if (!value || value.toString().trim() === '') missing.push(field.label);
    });
    return missing;
  };

  const prepareTemplateHtml = async (studentData: Student) => {
    setTemplateLoading(true);
    try {
      const academicRecords = await getAcademicRecordsByStudent(studentData.prn);
      const fees = await getFeePayments(studentData.prn);
      const technical = await getStudentActivities(studentData.prn);
      const achievements = await getAchievements(studentData.prn);
      const internships = await getInternships(studentData.prn);

      let totalPaid = 0, lastBalance = 0;
      fees.forEach(f => { totalPaid += (f.amountPaid || 0); lastBalance = f.remainingBalance || 0; });

      const combined = [
        ...technical.map(t => ({ date: t.activityDate, type: t.type === 'Co-curricular' ? 'Technical' : (t.type === 'Extra-curricular' ? 'Non-Technical' : t.type), name: t.activityName, status: t.verificationStatus })),
        ...achievements.map(a => ({ date: a.achievementDate, type: a.type || 'Technical', name: a.achievementName, status: a.verificationStatus }))
      ];

      const b64LogoLeft = await getBase64Image(LOGO_LEFT_IMG);
      const b64LogoRight = await getBase64Image(LOGO_RIGHT_IMG);
      const b64Photo = await getBase64Image(studentData.photoUri || require('../../assets/images/icon.png'));

      const dataMap = {
        college_logo_left: b64LogoLeft,
        college_logo_right: b64LogoRight,
        report_title: "Professional Student Progress Report",
        gen_date: new Date().toLocaleDateString(),
        filters_used: `${studentData.branch} | ${studentData.yearOfStudy} | Div: ${studentData.division}`,
        student_photo: b64Photo,
        full_name: (studentData.fullName || '').toUpperCase(),
        prn: studentData.prn,
        branch: studentData.branch || '',
        year: studentData.yearOfStudy || '',
        division: studentData.division || '',
        dob: studentData.dob || '',
        gender: studentData.gender || '',
        email: studentData.email || '',
        phone: studentData.phone || '',
        aadhar: studentData.aadhar || '',
        category: studentData.category || '',
        permanent_addr: studentData.permanentAddress || '',
        temp_addr: studentData.temporaryAddress || studentData.permanentAddress || '',
        father_name: studentData.fatherName || '',
        mother_name: studentData.motherName || '',
        father_phone: studentData.fatherPhone || 'N/A',
        annual_income: `₹${studentData.annualIncome || '0'}`,
        ssc_school: studentData.sscSchool || 'N/A',
        ssc_total: studentData.sscMaxMarks ? studentData.sscMaxMarks.toString() : 'N/A',
        ssc_obtained: studentData.sscMarks ? studentData.sscMarks.toString() : 'N/A',
        ssc_perc: studentData.sscPercentage ? studentData.sscPercentage.toString() : '0',
        hsc_diploma_label: (studentData.admissionType === 'DSE' || !!studentData.diplomaCollege) ? 'Diploma' : 'HSC (12th)',
        hsc_diploma_college: (studentData.admissionType === 'DSE' || !!studentData.diplomaCollege) ? (studentData.diplomaCollege || 'N/A') : (studentData.hscCollege || 'N/A'),
        hsc_diploma_total: (studentData.admissionType === 'DSE' || !!studentData.diplomaCollege) ? (studentData.diplomaMaxMarks || 'N/A') : (studentData.hscMaxMarks || 'N/A'),
        hsc_diploma_obtained: (studentData.admissionType === 'DSE' || !!studentData.diplomaCollege) ? (studentData.diplomaMarks || 'N/A') : (studentData.hscMarks || 'N/A'),
        hsc_diploma_perc: (studentData.admissionType === 'DSE' || !!studentData.diplomaCollege) ? (studentData.diplomaPercentage || '0') : (studentData.hscPercentage || '0'),
        sgpa: academicRecords.length > 0 ? academicRecords[academicRecords.length - 1].sgpa?.toString() || 'N/A' : 'N/A',
        cgpa: academicRecords.length > 0 ? academicRecords[academicRecords.length - 1].cgpa?.toString() || 'N/A' : 'N/A',
        total_fee: fees.length > 0 ? (fees[0].totalFee || 0).toString() : '0',
        paid_fee: totalPaid.toString(),
        balance_fee: lastBalance.toString(),
        academic_table: `<table><thead><tr><th>Sem</th><th>Course</th><th>MSE</th><th>ESE</th><th>Grade</th></tr></thead><tbody>${academicRecords.length > 0 ? academicRecords.map(r => `<tr><td>${r.semester}</td><td>${r.courseName}</td><td>${r.mseMarks || 0}</td><td>${r.eseMarks || 0}</td><td>${r.grade}</td></tr>`).join('') : '<tr><td colspan="5" style="text-align:center">No records</td></tr>'}</tbody></table>`,
        fee_table: `<table><thead><tr><th>Year</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>${fees.length > 0 ? fees.map(f => `<tr><td>${f.academicYear}</td><td>₹${f.amountPaid}</td><td>₹${f.remainingBalance}</td><td>${f.verificationStatus}</td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center">No records</td></tr>'}</tbody></table>`,
        activities_table: `<table><thead><tr><th>Category</th><th>Name</th><th>Date</th><th>Status</th></tr></thead><tbody>${combined.length > 0 ? combined.map(a => `<tr><td><strong>${a.type}</strong></td><td>${a.name}</td><td>${a.date}</td><td class="status-${(a.status || 'Pending').toLowerCase()}">${a.status || 'Pending'}</td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center">No records</td></tr>'}</tbody></table>`,
        internships_table: `<table><thead><tr><th>Company</th><th>Role</th><th>Status</th></tr></thead><tbody>${internships.length > 0 ? internships.map(i => `<tr><td>${i.companyName}</td><td>${i.role}</td><td>${i.verificationStatus}</td></tr>`).join('') : '<tr><td colspan="3" style="text-align:center">No records</td></tr>'}</tbody></table>`,
        view_receipt_btn: '',
        view_certificate_btn: ''
      };

      setHtmlContent(populateTemplate(dataMap, false));
    } catch (e) {
      console.error('Template preparation error:', e);
    } finally {
      setTemplateLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const session = await checkAuth();
      if (session) {
        setUserEmail(session.email || '');
        setUserPassword(session.password || '');
        if (session.firstLogin && session.role === 'student') setShowPasswordModal(true);
        const data = await getStudentInfo(session.prn as string);
        setProfile(data);
        if (data) await prepareTemplateHtml(data);
        if (data && !session.firstLogin) {
          const missing = checkProfileCompletion(data);
          if (missing.length > 0) { setMissingFields(missing); setIncompleteModalVisible(true); }
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handlePasswordChangeSuccess = async () => {
    setShowPasswordModal(false);
    const session = await getSession();
    if (session) {
      session.firstLogin = false;
      await saveSession(session);
      if (profile) {
        const missing = checkProfileCompletion(profile);
        if (missing.length > 0) { setMissingFields(missing); setIncompleteModalVisible(true); }
      }
    }
  };

  const downloadReport = async () => {
    if (!profile) return;
    setTemplateLoading(true);
    try {
      if (!htmlContent) await prepareTemplateHtml(profile);

      await generatePDF({
        fileName: `${profile.prn}_Student_Profile.pdf`,
        data: profile,
        htmlTemplate: htmlContent
      });

      if (Platform.OS !== 'web') {
        Alert.alert('Success', 'Profile report generated!');
      } else {
        Alert.alert('Success', 'Profile downloaded successfully!');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to generate PDF');
    } finally {
      setTemplateLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchProfile(); };

  const handleLogout = () => {
    if (Platform.OS === 'web') { if (confirm('Are you sure you want to logout?')) performLogout(); }
    else Alert.alert('Logout', 'Are you sure you want to logout?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Logout', style: 'destructive', onPress: performLogout }]);
  };

  const performLogout = async () => {
    try { await logout(); router.replace('/' as any); }
    catch (error) { if (Platform.OS === 'web') alert('Failed to logout'); else Alert.alert('Error', 'Failed to logout'); }
  };

  const modules = [
    { id: 'academic-records', title: 'Academic Records', icon: 'school-outline', color: COLORS.primary, route: '/student/academic-records' },
    { id: 'fees', title: 'Fee Payments', icon: 'card-outline', color: COLORS.secondary, route: '/student/fee-payments' },
    { id: 'activities', title: 'Activities', icon: 'trophy-outline', color: COLORS.accent, route: '/student/activities' },
    { id: 'achievements', title: 'Achievements', icon: 'ribbon-outline', color: COLORS.warning, route: '/student/achievements' },
    { id: 'internships', title: 'Internships', icon: 'briefcase-outline', color: COLORS.error, route: '/student/internships' },
    { id: 'documents', title: 'Documents', icon: 'document-text-outline', color: COLORS.textSecondary, route: '/student/documents' }
  ];

  const getModuleCardWidth = () => {
    if (isXLargeScreen) return (width - 80) / 3 - 12;
    return (width - 64) / 2 - 8;
  };

  const styles = createStyles(width, isLargeScreen, isXLargeScreen);

  if (loading) return (
    <View style={styles.loadingContainer}>
      <View style={styles.loadingContent}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    </View>
  );

  if (!profile) return (
    <View style={styles.errorContainer}>
      <View style={styles.errorContent}>
        <View style={styles.errorIcon}><Ionicons name="person-outline" size={48} color={COLORS.primary} /></View>
        <Text style={styles.errorTitle}>Profile Not Found</Text>
        <Text style={styles.errorText}>Please complete your profile to access the dashboard</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/student/personal-info' as any)}>
          <Text style={styles.primaryButtonText}>Complete Profile</Text>
          <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerBrand}>
            <View style={styles.logoCircle}>
              <Image source={LOGO_LEFT_IMG} style={styles.headerLogo} resizeMode="contain" />
            </View>
            <View>
              <Text style={styles.brandTitle}>GFM</Text>
              <Text style={styles.brandSub}>Record Management</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.profileIconBtn}
            onPress={() => setShowProfileMenu(true)}
            activeOpacity={0.7}
          >
            {!!profile?.photoUri ? (
              <Image source={{ uri: profile.photoUri }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerAvatarFallback}>
                <Ionicons name="person" size={20} color={COLORS.primary} />
              </View>
            )}
            <View style={styles.onlineBadge} />
          </TouchableOpacity>
        </View>

        <View style={styles.welcomeSection}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.studentName} numberOfLines={1}>{profile?.fullName || 'Student'}</Text>
          </View>
          <View style={styles.prnContainer}>
            <Text style={styles.prnLabel}>PRN:</Text>
            <Text style={styles.prnValue}>{profile?.prn}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <View style={[styles.statIconCircle, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="business-outline" size={20} color="#1E88E5" />
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.statLabel}>Dept</Text>
              <Text style={styles.statValue} numberOfLines={1}>{profile?.branch || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.statBox}>
            <View style={[styles.statIconCircle, { backgroundColor: '#F1F8E9' }]}>
              <Ionicons name="layers-outline" size={20} color="#43A047" />
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.statLabel}>Div</Text>
              <Text style={styles.statValue}>{profile?.division || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.statBox}>
            <View style={[styles.statIconCircle, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="list" size={20} color="#EF6C00" />
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.statLabel}>Roll No</Text>
              <Text style={styles.statValue}>{profile?.rollNo || 'N/A'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.modulesSection}>
          <Text style={styles.sectionHeading}>Academic Services</Text>
          <View style={styles.modulesGrid}>
            {[
              { id: 'academic-records', title: 'Academic', icon: 'school-outline', color: '#6366F1', route: '/student/academic-records' },
              { id: 'fees', title: 'Fees', icon: 'wallet-outline', color: '#F59E0B', route: '/student/fee-payments' },
              { id: 'achievements', title: 'Achievements', icon: 'trophy-outline', color: '#EC4899', route: '/student/achievements' },
              { id: 'activity', title: 'Activities', icon: 'rocket-outline', color: '#8B5CF6', route: '/student/activities' },
              { id: 'internship', title: 'Internship', icon: 'briefcase-outline', color: '#3B82F6', route: '/student/internships' },
              { id: 'documents', title: 'Documents', icon: 'folder-open-outline', color: '#64748B', route: '/student/documents' },
            ].map((module) => (
              <TouchableOpacity
                key={module.id}
                style={[styles.moduleCard, { width: getModuleCardWidth() }]}
                onPress={() => router.push(module.route as any)}
                activeOpacity={0.8}
              >
                <View style={[styles.moduleIconContainer, { backgroundColor: `${module.color}15` }]}>
                  <Ionicons name={module.icon as any} size={26} color={module.color} />
                </View>
                <Text style={styles.moduleCardTitle}>{module.title}</Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.textLight} style={styles.moduleChevron} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Last updated: {!!profile?.lastUpdated ? new Date(profile.lastUpdated).toLocaleDateString() : 'Never'}</Text>
          <Text style={[styles.footerText, { marginTop: 4 }]}>GFM Management System v2.1</Text>
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal animationType="slide" transparent={false} visible={profileModalVisible} onRequestClose={() => setProfileModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setProfileModalVisible(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Detailed Profile</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.modalTabs}>
            <TouchableOpacity style={[styles.modalTab, viewMode === 'details' && styles.modalTabActive]} onPress={() => setViewMode('details')}>
              <Ionicons name="person-outline" size={18} color={viewMode === 'details' ? COLORS.primary : COLORS.textLight} />
              <Text style={[styles.modalTabText, viewMode === 'details' && styles.modalTabTextActive]}>Quick Info</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalTab, viewMode === 'template' && styles.modalTabActive]} onPress={() => setViewMode('template')}>
              <Ionicons name="document-text-outline" size={18} color={viewMode === 'template' ? COLORS.primary : COLORS.textLight} />
              <Text style={[styles.modalTabText, viewMode === 'template' && styles.modalTabTextActive]}>Report Card</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {viewMode === 'details' ? (
              <>
                <View style={styles.modalProfileHeader}>
                  <Image source={{ uri: profile.photoUri || FALLBACK_LOGO }} style={styles.modalProfileImage} />
                  <Text style={styles.modalProfileName}>{profile.fullName}</Text>
                  <Text style={styles.modalProfilePrn}>PRN: {profile.prn}</Text>
                  <View style={[styles.statusBadge, profile.verificationStatus === 'Verified' ? styles.verifiedBadge : (profile.verificationStatus === 'Rejected' ? styles.rejectedBadge : styles.pendingBadge)]}>
                    <Ionicons
                      name={profile.verificationStatus === 'Verified' ? 'checkmark-circle' : (profile.verificationStatus === 'Rejected' ? 'close-circle' : 'time')}
                      size={14}
                      color={profile.verificationStatus === 'Verified' ? COLORS.success : (profile.verificationStatus === 'Rejected' ? COLORS.error : COLORS.warning)}
                    />
                    <Text style={[styles.statusText, { color: profile.verificationStatus === 'Verified' ? COLORS.success : (profile.verificationStatus === 'Rejected' ? COLORS.error : COLORS.warning) }]}>
                      {profile.verificationStatus || 'Pending'}
                    </Text>
                  </View>
                </View>

                <ProfileSection title="Personal Details" icon="person" isLargeScreen={isLargeScreen}>
                  <ProfileRow label="Full Name" value={profile.fullName} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Gender" value={profile.gender} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Date of Birth" value={profile.dob} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Religion" value={profile.religion} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Category" value={profile.category} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Caste" value={profile.caste} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Aadhar" value={profile.aadhar} isLargeScreen={isLargeScreen} />
                </ProfileSection>

                <ProfileSection title="Academic Context" icon="school" isLargeScreen={isLargeScreen}>
                  <ProfileRow label="Branch" value={profile.branch} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Year" value={getFullYearName(profile.yearOfStudy || '')} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Division" value={profile.division} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Roll No" value={profile.rollNo} isLargeScreen={isLargeScreen} />
                </ProfileSection>

                <ProfileSection title="Contact Info" icon="call" isLargeScreen={isLargeScreen}>
                  <ProfileRow label="Phone" value={profile.phone} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Email" value={profile.email} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Temp Address" value={profile.temporaryAddress} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Perm. Address" value={profile.permanentAddress} isLargeScreen={isLargeScreen} />
                </ProfileSection>

                <ProfileSection title="Family Background" icon="people" isLargeScreen={isLargeScreen}>
                  <ProfileRow label="Father's Name" value={profile.fatherName} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Mother's Name" value={profile.motherName} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Father's Phone" value={profile.fatherPhone} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Mother's Phone" value={profile.motherPhone} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Annual Income" value={profile.annualIncome ? `₹${profile.annualIncome}` : 'N/A'} isLargeScreen={isLargeScreen} />
                </ProfileSection>

                <ProfileSection title="Education History" icon="ribbon" isLargeScreen={isLargeScreen}>
                  <ProfileRow label="SSC School" value={profile.sscSchool} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="SSC %" value={profile.sscPercentage} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="HSC College" value={profile.hscCollege} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="HSC %" value={profile.hscPercentage} isLargeScreen={isLargeScreen} />
                  {!!profile.diplomaCollege && (
                    <>
                      <ProfileRow label="Diploma College" value={profile.diplomaCollege} isLargeScreen={isLargeScreen} />
                      <ProfileRow label="Diploma %" value={profile.diplomaPercentage} isLargeScreen={isLargeScreen} />
                    </>
                  )}
                </ProfileSection>
                <View style={{ height: 40 }} />
              </>
            ) : (
              <View style={styles.templateContainer}>
                {templateLoading ? (
                  <View style={styles.templateLoading}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.templateLoadingText}>Preparing Your Report...</Text>
                  </View>
                ) : htmlContent ? (
                  isWeb ? (
                    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', width: '100%', maxWidth: '800px', margin: '0 auto' }} dangerouslySetInnerHTML={{ __html: htmlContent }} />
                  ) : (
                    <View style={styles.templatePlaceholder}><Text style={styles.templatePlaceholderText}>Preview available on Web. Please download PDF to view.</Text></View>
                  )
                ) : (
                  <View style={styles.templatePlaceholder}><Text style={styles.templatePlaceholderText}>No report data found</Text></View>
                )}
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.footerBtn, styles.secondaryBtn]} onPress={downloadReport} disabled={templateLoading}>
              <Ionicons name="cloud-download-outline" size={20} color={COLORS.primary} />
              <Text style={styles.secondaryBtnText}>Download PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.footerBtn, styles.primaryBtn]} onPress={() => { setProfileModalVisible(false); router.push('/student/personal-info' as any); }}>
              <Ionicons name="create-outline" size={20} color={COLORS.white} />
              <Text style={styles.primaryBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ChangePasswordModal
        visible={showPasswordModal}
        userEmail={userEmail}
        currentPassword={userPassword}
        onSuccess={handlePasswordChangeSuccess}
      />

      <ProfileMenu
        visible={showProfileMenu}
        onClose={() => setShowProfileMenu(false)}
        userName={profile?.fullName || 'Student'}
        userEmail={userEmail}
        photoUri={profile?.photoUri}
        menuItems={[
          {
            icon: 'person-outline',
            label: 'Quick Profile',
            onPress: () => setProfileModalVisible(true)
          },
          {
            icon: 'create-outline',
            label: 'Edit Info',
            onPress: () => router.push('/student/personal-info' as any)
          },
          {
            icon: 'key-outline',
            label: 'Change Password',
            onPress: () => setShowPasswordModal(true)
          },
          {
            icon: 'log-out-outline',
            label: 'Logout',
            onPress: handleLogout,
            color: COLORS.error
          }
        ]}
      />

      <Modal animationType="fade" transparent={true} visible={incompleteModalVisible} onRequestClose={() => { }}>
        <View style={styles.incompleteOverlay}>
          <View style={styles.incompleteCard}>
            <View style={styles.incompleteIcon}><Ionicons name="alert-circle" size={48} color={COLORS.warning} /></View>
            <Text style={styles.incompleteTitle}>Profile Incomplete</Text>
            <Text style={styles.incompleteSubtitle}>Please update these fields for full access:</Text>
            <ScrollView style={styles.missingList}>
              {missingFields.map((field, index) => (
                <View key={index} style={styles.missingItem}>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.error} />
                  <Text style={styles.missingText}>{field}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.completeBtn} onPress={() => { setIncompleteModalVisible(false); router.push('/student/personal-info' as any); }}>
              <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
              <Text style={styles.completeBtnText}>Continue Setup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const ProfileSection: React.FC<{ title: string; icon: string; children: React.ReactNode; isLargeScreen: boolean }> = ({ title, icon, children, isLargeScreen }) => (
  <View style={{ backgroundColor: COLORS.white, marginHorizontal: isLargeScreen ? 24 : 16, marginBottom: 16, borderRadius: 16, padding: isLargeScreen ? 20 : 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 }}>
      <Ionicons name={icon as any} size={20} color={COLORS.primary} />
      <Text style={{ fontSize: isLargeScreen ? 17 : 16, fontWeight: 'bold', color: COLORS.primary }}>{title}</Text>
    </View>
    {children}
  </View>
);

const ProfileRow: React.FC<{ label: string; value?: string; isLargeScreen: boolean }> = ({ label, value, isLargeScreen }) => (
  <View style={{ flexDirection: 'row', paddingVertical: isLargeScreen ? 12 : 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight }}>
    <Text style={{ flex: 1, fontSize: isLargeScreen ? 15 : 14, color: COLORS.textSecondary }}>{label}</Text>
    <Text style={{ flex: 1, fontSize: isLargeScreen ? 15 : 14, color: COLORS.text, fontWeight: '500', textAlign: 'right' }}>{value || 'N/A'}</Text>
  </View>
);

