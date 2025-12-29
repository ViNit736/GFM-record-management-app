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
import { logout } from '../../services/auth.service';
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
const LOGO_RIGHT_IMG = require('../../assets/images/right.jpeg');
const FALLBACK_LOGO = "https://via.placeholder.com/80?text=LOGO";

const getBase64Image = (source: any, timeout = 5000): Promise<string> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !source) return resolve('');
    if (typeof source === 'string' && source.startsWith('data:')) return resolve(source);
    let url = typeof source === 'string' ? source : Image.resolveAssetSource(source)?.uri;
    if (!url) return resolve('');
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
  });
};

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
  const [sessionData, setSessionData] = useState<{ email: string; password: string } | null>(null);
  const [viewMode, setViewMode] = useState<'details' | 'template'>('details');

  const checkAuth = async () => {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      router.replace('/');
      return null;
    }
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
      const b64Photo = await getBase64Image(studentData.photoUri || 'https://via.placeholder.com/150');

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
        setSessionData({ email: session.email, password: session.password || '' });
        if (session.firstLogin && session.role === 'student') setShowPasswordModal(true);
        const data = await getStudentInfo(session.prn);
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
    if (isLargeScreen) return (width - 64) / 2 - 8;
    return '100%';
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
    <>
      <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerBrand}>
              <Ionicons name="school" size={isLargeScreen ? 28 : 24} color={COLORS.white} />
              <Text style={styles.brandName}>GFM Record</Text>
            </View>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color={COLORS.white} />
              {isLargeScreen && <Text style={styles.logoutText}>Logout</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.profileSection}>
            <TouchableOpacity style={styles.profileImageContainer} onPress={() => setProfileModalVisible(true)}>
              <Image source={{ uri: profile.photoUri || 'https://via.placeholder.com/120' }} style={styles.profileImage} />
              <View style={styles.viewBadge}><Ionicons name="eye" size={14} color={COLORS.white} /></View>
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <Text style={styles.welcomeLabel}>Welcome back,</Text>
              <Text style={styles.profileName}>{profile.fullName || 'Student'}</Text>
              <View style={styles.prnBadge}><Text style={styles.prnText}>PRN: {profile.prn}</Text></View>
            </View>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: `${COLORS.primary}15` }]}><Ionicons name="school-outline" size={isLargeScreen ? 26 : 22} color={COLORS.primary} /></View>
            <Text style={styles.statLabel}>Branch</Text>
            <Text style={styles.statValue}>{profile.branch || 'N/A'}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: `${COLORS.secondary}15` }]}><Ionicons name="calendar-outline" size={isLargeScreen ? 26 : 22} color={COLORS.secondary} /></View>
            <Text style={styles.statLabel}>Year</Text>
            <Text style={styles.statValue}>{profile.yearOfStudy || 'N/A'}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: `${COLORS.accent}15` }]}><Ionicons name="grid-outline" size={isLargeScreen ? 26 : 22} color={COLORS.accent} /></View>
            <Text style={styles.statLabel}>Division</Text>
            <Text style={styles.statValue}>{profile.division || 'N/A'}</Text>
          </View>
        </View>

        <View style={styles.modulesSection}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.modulesGrid}>
            {modules.map((module) => (
              <TouchableOpacity
                key={module.id}
                style={[styles.moduleCard, typeof getModuleCardWidth() === 'number' && { width: getModuleCardWidth() as number }]}
                onPress={() => router.push(module.route as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.moduleIconBg, { backgroundColor: `${module.color}12` }]}><Ionicons name={module.icon as any} size={isLargeScreen ? 32 : 28} color={module.color} /></View>
                <Text style={styles.moduleTitle}>{module.title}</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.editButton} onPress={() => router.push('/student/personal-info' as any)} activeOpacity={0.8}>
          <Ionicons name="create-outline" size={20} color={COLORS.white} />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        <View style={styles.footer}><Text style={styles.footerText}>Last updated: {profile.lastUpdated ? new Date(profile.lastUpdated).toLocaleDateString() : 'Never'}</Text></View>
      </ScrollView>

      <Modal animationType="slide" transparent={false} visible={profileModalVisible} onRequestClose={() => setProfileModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setProfileModalVisible(false)} style={styles.modalCloseBtn}><Ionicons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
            <Text style={styles.modalTitle}>Student Profile</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.modalTabs}>
            <TouchableOpacity style={[styles.modalTab, viewMode === 'details' && styles.modalTabActive]} onPress={() => setViewMode('details')}>
              <Ionicons name="list-outline" size={18} color={viewMode === 'details' ? COLORS.primary : COLORS.textLight} />
              <Text style={[styles.modalTabText, viewMode === 'details' && styles.modalTabTextActive]}>Details</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalTab, viewMode === 'template' && styles.modalTabActive]} onPress={() => setViewMode('template')}>
              <Ionicons name="document-outline" size={18} color={viewMode === 'template' ? COLORS.primary : COLORS.textLight} />
              <Text style={[styles.modalTabText, viewMode === 'template' && styles.modalTabTextActive]}>Report Preview</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={isLargeScreen ? { maxWidth: 800, alignSelf: 'center', width: '100%' } : undefined}>
            {viewMode === 'details' ? (
              <>
                <View style={styles.modalProfileHeader}>
                  <Image source={{ uri: profile.photoUri || 'https://via.placeholder.com/150' }} style={styles.modalProfileImage} />
                  <Text style={styles.modalProfileName}>{profile.fullName}</Text>
                  <Text style={styles.modalProfilePrn}>PRN: {profile.prn}</Text>
                  <View style={[styles.statusBadge, profile.verificationStatus === 'Verified' ? styles.verifiedBadge : (profile.verificationStatus === 'Rejected' ? styles.rejectedBadge : styles.pendingBadge)]}>
                    <Ionicons name={profile.verificationStatus === 'Verified' ? 'checkmark-circle' : (profile.verificationStatus === 'Rejected' ? 'close-circle' : 'time')} size={14} color={profile.verificationStatus === 'Verified' ? COLORS.success : (profile.verificationStatus === 'Rejected' ? COLORS.error : COLORS.warning)} />
                    <Text style={[styles.statusText, { color: profile.verificationStatus === 'Verified' ? COLORS.success : (profile.verificationStatus === 'Rejected' ? COLORS.error : COLORS.warning) }]}>{profile.verificationStatus || 'Pending'}</Text>
                  </View>
                </View>

                <ProfileSection title="Personal Information" icon="person-outline" isLargeScreen={isLargeScreen}>
                  <ProfileRow label="Full Name" value={profile.fullName} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Gender" value={profile.gender} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Date of Birth" value={profile.dob} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Religion" value={profile.religion} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Category" value={profile.category} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Caste" value={profile.caste} isLargeScreen={isLargeScreen} />
                </ProfileSection>

                <ProfileSection title="Contact Information" icon="call-outline" isLargeScreen={isLargeScreen}>
                  <ProfileRow label="Phone Number" value={profile.phone} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Email ID" value={profile.email} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Aadhaar Number" value={profile.aadhar} isLargeScreen={isLargeScreen} />
                </ProfileSection>

                <ProfileSection title="Address" icon="location-outline" isLargeScreen={isLargeScreen}>
                  <ProfileRow label="Permanent Address" value={profile.permanentAddress} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Pincode" value={profile.pincode} isLargeScreen={isLargeScreen} />
                  {profile.temporaryAddress && <ProfileRow label="Temporary Address" value={profile.temporaryAddress} isLargeScreen={isLargeScreen} />}
                </ProfileSection>

                <ProfileSection title="Family Details" icon="people-outline" isLargeScreen={isLargeScreen}>
                  <ProfileRow label="Father/Guardian Name" value={profile.fatherName} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Father's Occupation" value={profile.fatherOccupation} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Father's Phone" value={profile.fatherPhone} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Mother's Name" value={profile.motherName} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Mother's Occupation" value={profile.motherOccupation} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Mother's Phone" value={profile.motherPhone} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Annual Income" value={`₹${profile.annualIncome}`} isLargeScreen={isLargeScreen} />
                </ProfileSection>

                <ProfileSection title="Academic Details" icon="school-outline" isLargeScreen={isLargeScreen}>
                  <ProfileRow label="Branch" value={profile.branch} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Year of Study" value={profile.yearOfStudy} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Division" value={profile.division} isLargeScreen={isLargeScreen} />
                  <ProfileRow label="Admission Type" value={profile.admissionType} isLargeScreen={isLargeScreen} />
                  {profile.jeePercentile && <ProfileRow label="JEE Percentile" value={profile.jeePercentile} isLargeScreen={isLargeScreen} />}
                  {profile.mhtCetPercentile && <ProfileRow label="MHT-CET Percentile" value={profile.mhtCetPercentile} isLargeScreen={isLargeScreen} />}
                </ProfileSection>
                <View style={{ height: 100 }} />
              </>
            ) : (
              <View style={styles.templateContainer}>
                {templateLoading ? (
                  <View style={styles.templateLoading}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.templateLoadingText}>Generating Preview...</Text>
                  </View>
                ) : htmlContent ? (
                  isWeb ? (
                    <div style={{ backgroundColor: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', width: '100%', maxWidth: '210mm', margin: '0 auto', transform: width < 800 ? `scale(${Math.min(1, (width - 40) / 794)})` : 'none', transformOrigin: 'top center' }} dangerouslySetInnerHTML={{ __html: htmlContent }} />
                  ) : (
                    <View style={styles.templatePlaceholder}><Text style={styles.templatePlaceholderText}>Template preview is optimized for web. Use Download PDF option.</Text></View>
                  )
                ) : (
                  <View style={styles.templatePlaceholder}><Text style={styles.templatePlaceholderText}>No template available</Text></View>
                )}
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.footerBtn, styles.secondaryBtn]} onPress={downloadReport} disabled={templateLoading}>
              <Ionicons name="download-outline" size={20} color={COLORS.primary} />
              <Text style={styles.secondaryBtnText}>Download PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.footerBtn, styles.primaryBtn]} onPress={() => { setProfileModalVisible(false); router.push('/student/personal-info' as any); }}>
              <Ionicons name="create-outline" size={20} color={COLORS.white} />
              <Text style={styles.primaryBtnText}>Edit Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {sessionData && <ChangePasswordModal visible={showPasswordModal} userEmail={sessionData.email} currentPassword={sessionData.password} onSuccess={handlePasswordChangeSuccess} isFirstLogin={true} />}

      <Modal animationType="fade" transparent={true} visible={incompleteModalVisible} onRequestClose={() => { }}>
        <View style={styles.incompleteOverlay}>
          <View style={styles.incompleteCard}>
            <View style={styles.incompleteIcon}><Ionicons name="alert-circle" size={48} color={COLORS.warning} /></View>
            <Text style={styles.incompleteTitle}>Complete Your Profile</Text>
            <Text style={styles.incompleteSubtitle}>Please fill in the following information:</Text>
            <ScrollView style={styles.missingList}>
              {missingFields.map((field, index) => (
                <View key={index} style={styles.missingItem}><Ionicons name="close-circle" size={18} color={COLORS.error} /><Text style={styles.missingText}>{field}</Text></View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.completeBtn} onPress={() => { setIncompleteModalVisible(false); router.push('/student/personal-info' as any); }}>
              <Ionicons name="create-outline" size={20} color={COLORS.white} />
              <Text style={styles.completeBtnText}>Complete Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
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

const createStyles = (width: number, isLargeScreen: boolean, isXLargeScreen: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingContent: { alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: COLORS.textSecondary },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, padding: 24 },
  errorContent: { alignItems: 'center', maxWidth: 320 },
  errorIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: `${COLORS.primary}15`, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  errorTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.text, marginBottom: 8 },
  errorText: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, gap: 8 },
  primaryButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: isLargeScreen ? 40 : 30,
    paddingHorizontal: isLargeScreen ? 32 : 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: isLargeScreen ? 32 : 24 },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandName: { fontSize: isLargeScreen ? 22 : 18, fontWeight: 'bold', color: COLORS.white },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: isLargeScreen ? 16 : 10,
    paddingVertical: isLargeScreen ? 10 : 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)'
  },
  logoutText: { color: COLORS.white, fontWeight: '600', fontSize: 14 },
  profileSection: { flexDirection: 'row', alignItems: 'center' },
  profileImageContainer: { position: 'relative' },
  profileImage: {
    width: isLargeScreen ? 88 : 72,
    height: isLargeScreen ? 88 : 72,
    borderRadius: isLargeScreen ? 44 : 36,
    borderWidth: 3,
    borderColor: COLORS.white
  },
  viewBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.white },
  profileInfo: { flex: 1, marginLeft: isLargeScreen ? 20 : 16 },
  welcomeLabel: { fontSize: isLargeScreen ? 15 : 13, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  profileName: { fontSize: isLargeScreen ? 26 : 20, fontWeight: 'bold', color: COLORS.white, marginBottom: 6 },
  prnBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, alignSelf: 'flex-start' },
  prnText: { fontSize: isLargeScreen ? 14 : 12, color: COLORS.white, fontWeight: '500' },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: isLargeScreen ? 32 : 16,
    marginTop: -20,
    gap: isLargeScreen ? 16 : 12
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: isLargeScreen ? 20 : 16,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4
  },
  statIconBg: {
    width: isLargeScreen ? 52 : 44,
    height: isLargeScreen ? 52 : 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isLargeScreen ? 12 : 10
  },
  statLabel: { fontSize: isLargeScreen ? 13 : 12, color: COLORS.textLight, marginBottom: 4 },
  statValue: { fontSize: isLargeScreen ? 17 : 15, fontWeight: 'bold', color: COLORS.text },
  modulesSection: { padding: isLargeScreen ? 32 : 20 },
  sectionTitle: { fontSize: isLargeScreen ? 20 : 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 16 },
  modulesGrid: {
    flexDirection: isLargeScreen ? 'row' : 'column',
    flexWrap: 'wrap',
    gap: isLargeScreen ? 16 : 12
  },
  moduleCard: {
    backgroundColor: COLORS.white,
    padding: isLargeScreen ? 20 : 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2
  },
  moduleIconBg: {
    width: isLargeScreen ? 56 : 48,
    height: isLargeScreen ? 56 : 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: isLargeScreen ? 16 : 14
  },
  moduleTitle: { flex: 1, fontSize: isLargeScreen ? 16 : 15, fontWeight: '600', color: COLORS.text },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    marginHorizontal: isLargeScreen ? 32 : 20,
    padding: isLargeScreen ? 18 : 16,
    borderRadius: 14,
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  editButtonText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
  footer: { padding: 20, alignItems: 'center' },
  footerText: { fontSize: 12, color: COLORS.textLight },
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: isLargeScreen ? 24 : 16, paddingTop: Platform.OS === 'ios' ? 60 : 20, paddingBottom: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalCloseBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: isLargeScreen ? 20 : 18, fontWeight: 'bold', color: COLORS.text },
  modalTabs: { flexDirection: 'row', backgroundColor: COLORS.white, paddingHorizontal: isLargeScreen ? 24 : 16, paddingBottom: 12, gap: 12 },
  modalTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: COLORS.background, gap: 6, maxWidth: 200 },
  modalTabActive: { backgroundColor: `${COLORS.primary}12` },
  modalTabText: { fontSize: 14, color: COLORS.textLight, fontWeight: '500' },
  modalTabTextActive: { color: COLORS.primary },
  modalContent: { flex: 1 },
  modalProfileHeader: { alignItems: 'center', paddingVertical: isLargeScreen ? 32 : 24, backgroundColor: COLORS.white, marginBottom: 16 },
  modalProfileImage: {
    width: isLargeScreen ? 120 : 100,
    height: isLargeScreen ? 120 : 100,
    borderRadius: isLargeScreen ? 60 : 50,
    borderWidth: 3,
    borderColor: COLORS.primary,
    marginBottom: 16
  },
  modalProfileName: { fontSize: isLargeScreen ? 26 : 22, fontWeight: 'bold', color: COLORS.text, marginBottom: 4 },
  modalProfilePrn: { fontSize: isLargeScreen ? 15 : 14, color: COLORS.textSecondary, marginBottom: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, gap: 6 },
  verifiedBadge: { backgroundColor: `${COLORS.success}15` },
  rejectedBadge: { backgroundColor: `${COLORS.error}15` },
  pendingBadge: { backgroundColor: `${COLORS.warning}15` },
  statusText: { fontSize: 13, fontWeight: '600' },
  templateContainer: { padding: isLargeScreen ? 24 : 16 },
  templateLoading: { alignItems: 'center', paddingVertical: 60 },
  templateLoadingText: { marginTop: 16, fontSize: 14, color: COLORS.textSecondary },
  templatePlaceholder: { alignItems: 'center', paddingVertical: 60 },
  templatePlaceholderText: { fontSize: 14, color: COLORS.textLight, textAlign: 'center' },
  modalFooter: { flexDirection: 'row', padding: isLargeScreen ? 20 : 16, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 12 },
  footerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: isLargeScreen ? 16 : 14, borderRadius: 12, gap: 8, maxWidth: isLargeScreen ? 220 : undefined },
  secondaryBtn: { backgroundColor: `${COLORS.primary}12` },
  secondaryBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
  primaryBtn: { backgroundColor: COLORS.primary },
  primaryBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
  incompleteOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center', padding: 20 },
  incompleteCard: { backgroundColor: COLORS.white, borderRadius: 24, padding: isLargeScreen ? 32 : 24, width: '100%', maxWidth: 440, alignItems: 'center' },
  incompleteIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: `${COLORS.warning}15`, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  incompleteTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginBottom: 8 },
  incompleteSubtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 20 },
  missingList: { maxHeight: 200, width: '100%', marginBottom: 20 },
  missingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, backgroundColor: `${COLORS.error}08`, borderRadius: 10, marginBottom: 8, gap: 10 },
  missingText: { fontSize: 14, color: COLORS.error, fontWeight: '500' },
  completeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, gap: 8, width: '100%' },
  completeBtnText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
});
