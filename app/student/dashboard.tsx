import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
  Platform
} from 'react-native';
import { 
  getStudentInfo, 
  Student, 
  getAcademicRecordsByStudent, 
  getFeePayments, 
  getStudentActivities, 
  getAchievements, 
  getInternships 
} from '../../storage/sqlite';
import { logout } from '../../services/auth.service';
import { getSession } from '../../services/session.service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { jsPDF } from 'jspdf';
import { populateTemplate } from '../../services/pdf-template.service';
import { COLORS } from '../../constants/colors';

// Ensure jsPDF can find html2canvas if needed
if (typeof window !== 'undefined') {
  (window as any).html2canvas = require('html2canvas');
}

const { width } = Dimensions.get('window');

const isWeb = Platform.OS === 'web';

// Correct URLs for the current project or reliable placeholders
const LOGO_LEFT = "https://csvywizljbjpobeeadne.supabase.co/storage/v1/object/public/document-uploads/JSPM-logo-removebg-preview-1766666378755.png";
const LOGO_RIGHT = "https://csvywizljbjpobeeadne.supabase.co/storage/v1/object/public/document-uploads/jspm_group_logo-1766666412340.jpeg";
// Fallback placeholders if Supabase images are missing
const FALLBACK_LOGO = "https://via.placeholder.com/80?text=LOGO";

// Helper to convert Image URL to Base64 with timeout and error handling
const getBase64Image = (url: string, timeout = 5000): Promise<string> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !url) return resolve('');
    
    // Check if it's already a base64 or data URL
    if (url.startsWith('data:')) return resolve(url);

    const img = new Image();
    img.setAttribute('crossOrigin', 'anonymous');
    
    const timer = setTimeout(() => {
      img.src = ""; // Stop loading
      resolve(url); // Return original URL as fallback
    }, timeout);

    img.onload = () => {
      clearTimeout(timer);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        resolve(url);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(url.includes('supabase.co') ? FALLBACK_LOGO : url);
    };
    img.src = url;
  });
};

export default function StudentDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState<'details' | 'template'>('template');
  const [htmlContent, setHtmlContent] = useState('');
  const [templateLoading, setTemplateLoading] = useState(false);

  const checkAuth = async () => {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      router.replace('/login');
      return null;
    }
    return session;
  };

  const fetchProfile = async () => {
    try {
      const session = await checkAuth();
      if (session) {
        if (!session.isProfileComplete) {
          router.replace('/student/personal-info');
          return;
        }
        const data = await getStudentInfo(session.prn);
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const downloadReport = async () => {
    if (!profile || !isWeb) return;
    setTemplateLoading(true);
    try {
      const b64LogoLeft = await getBase64Image(LOGO_LEFT);
      const b64LogoRight = await getBase64Image(LOGO_RIGHT);
      const b64Photo = await getBase64Image(profile.photoUri || 'https://via.placeholder.com/150');
      
      const academicRecords = await getAcademicRecordsByStudent(profile.prn);
      const fees = await getFeePayments(profile.prn);
      const technical = await getStudentActivities(profile.prn);
      const achievements = await getAchievements(profile.prn);
      const internships = await getInternships(profile.prn);

      let totalPaid = 0;
      let lastBalance = 0;
      fees.forEach(f => {
        totalPaid += (f.amountPaid || 0);
        lastBalance = f.remainingBalance || 0;
      });

      // Unified Activities Table with labels
      const combined = [
        ...technical.map(t => ({ 
          date: t.activityDate, 
          type: t.type === 'Co-curricular' ? 'Technical' : (t.type === 'Extra-curricular' ? 'Non-Technical' : t.type), 
          name: t.activityName, 
          status: t.verificationStatus 
        })),
        ...achievements.map(a => ({ 
          date: a.achievementDate, 
          type: a.type || 'Technical', 
          name: a.achievementName, 
          status: a.verificationStatus 
        }))
      ];

      const dataMap = {
        college_logo_left: b64LogoLeft,
        college_logo_right: b64LogoRight,
        report_title: "Professional Student Progress Report",
        gen_date: new Date().toLocaleDateString(),
        filters_used: `${profile.branch} | ${profile.yearOfStudy} | Div: ${profile.division}`,
        student_photo: b64Photo,
        full_name: profile.fullName.toUpperCase(),
        prn: profile.prn,
        branch: profile.branch,
        year: profile.yearOfStudy,
        division: profile.division,
        dob: profile.dob,
        gender: profile.gender,
        email: profile.email,
        phone: profile.phone,
        aadhar: profile.aadhar,
        category: profile.category,
        permanent_addr: profile.permanentAddress,
        temp_addr: profile.temporaryAddress || profile.permanentAddress,
        father_name: profile.fatherName,
        mother_name: profile.motherName,
        father_phone: profile.fatherPhone || 'N/A',
        annual_income: `₹${profile.annualIncome || '0'}`,
        ssc_school: profile.sscSchool || 'N/A',
        ssc_total: profile.sscMaxMarks ? profile.sscMaxMarks.toString() : 'N/A',
        ssc_obtained: profile.sscMarks ? profile.sscMarks.toString() : 'N/A',
        ssc_perc: profile.sscPercentage ? profile.sscPercentage.toString() : '0',
        hsc_diploma_label: (profile.admissionType === 'DSE' || !!profile.diplomaCollege) ? 'Diploma' : 'HSC (12th)',
        hsc_diploma_college: (profile.admissionType === 'DSE' || !!profile.diplomaCollege) ? (profile.diplomaCollege || 'N/A') : (profile.hscCollege || 'N/A'),
        hsc_diploma_total: (profile.admissionType === 'DSE' || !!profile.diplomaCollege) ? (profile.diplomaMaxMarks || 'N/A') : (profile.hscMaxMarks || 'N/A'),
        hsc_diploma_obtained: (profile.admissionType === 'DSE' || !!profile.diplomaCollege) ? (profile.diplomaMarks || 'N/A') : (profile.hscMarks || 'N/A'),
        hsc_diploma_perc: (profile.admissionType === 'DSE' || !!profile.diplomaCollege) ? (profile.diplomaPercentage || '0') : (profile.hscPercentage || '0'),
        sgpa: academicRecords.length > 0 ? academicRecords[academicRecords.length - 1].sgpa.toString() : 'N/A',
        cgpa: academicRecords.length > 0 ? academicRecords[academicRecords.length - 1].cgpa.toString() : 'N/A',
        total_fee: fees.length > 0 ? (fees[0].totalFee || 0).toString() : '0',
        paid_fee: totalPaid.toString(),
        balance_fee: lastBalance.toString(),
        academic_table: `<table><thead><tr><th>Sem</th><th>Course</th><th>Total</th><th>Grade</th></tr></thead><tbody>${academicRecords.map(r => `<tr><td>${r.semester}</td><td>${r.courseName}</td><td>${r.totalMarks}</td><td>${r.grade}</td></tr>`).join('')}</tbody></table>`,
        fee_table: `<table><thead><tr><th>Year</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>${fees.map(f => `<tr><td>${f.academicYear}</td><td>₹${f.amountPaid}</td><td>₹${f.remainingBalance}</td><td>${f.verificationStatus}</td></tr>`).join('')}</tbody></table>`,
        activities_table: `<table><thead><tr><th>Category</th><th>Name</th><th>Date</th><th>Status</th></tr></thead><tbody>${combined.map(a => `<tr><td><strong>${a.type}</strong></td><td>${a.name}</td><td>${a.date}</td><td class="status-${(a.status || 'Pending').toLowerCase()}">${a.status || 'Pending'}</td></tr>`).join('')}</tbody></table>`,
        internships_table: `<table><thead><tr><th>Company</th><th>Role</th><th>Status</th></tr></thead><tbody>${internships.map(i => `<tr><td>${i.companyName}</td><td>${i.role}</td><td>${i.verificationStatus}</td></tr>`).join('')}</tbody></table>`,
        view_receipt_btn: '',
        view_certificate_btn: ''
      };

      const html = populateTemplate(dataMap, false);
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '-10000px';
      container.style.width = '210mm';
      container.style.backgroundColor = 'white';
      container.style.zIndex = '-9999';
      container.innerHTML = html;
      document.body.appendChild(container);

      // Ensure all images are loaded
      const images = container.getElementsByTagName('img');
      await Promise.all(Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }));
      
      await new Promise(r => setTimeout(r, 800));

      const html2canvas = (window as any).html2canvas;
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 800 });
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
      
      const pdfWidth = 210;
      const pdfHeight = 297;
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      doc.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        doc.addPage();
        doc.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;
      }

      doc.save(`${profile.prn}_Student_Profile.pdf`);
      document.body.removeChild(container);
      Alert.alert('Success', 'Profile downloaded successfully!');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to generate PDF');
    } finally {
      setTemplateLoading(false);
    }
  };

  const loadTemplateData = async () => {
    if (!profile) return;
    setTemplateLoading(true);
    try {
      const b64LogoLeft = await getBase64Image(LOGO_LEFT);
      const b64LogoRight = await getBase64Image(LOGO_RIGHT);
      const b64Photo = await getBase64Image(profile.photoUri || 'https://via.placeholder.com/150');

      const academicRecords = await getAcademicRecordsByStudent(profile.prn);
      const fees = await getFeePayments(profile.prn);
      const technical = await getStudentActivities(profile.prn);
      const achievements = await getAchievements(profile.prn);
      const internships = await getInternships(profile.prn);

      let totalPaid = 0;
      let lastBalance = 0;
      fees.forEach(f => {
        totalPaid += (f.amountPaid || 0);
        lastBalance = f.remainingBalance || 0;
      });

      let academicTable = '<table><thead><tr><th>Sem</th><th>Course</th><th>ISE</th><th>MSE</th><th>ESE</th><th>Total</th><th>Grade</th></tr></thead><tbody>';
      if (academicRecords.length > 0) {
        academicRecords.forEach(r => {
          academicTable += `<tr><td>${r.semester}</td><td>${r.courseName}</td><td>${r.iseMarks || 0}</td><td>${r.mseMarks || 0}</td><td>${r.eseMarks || 0}</td><td>${r.totalMarks}</td><td>${r.grade}</td></tr>`;
        });
      } else {
        academicTable += '<tr><td colspan="7">No records found</td></tr>';
      }
      academicTable += '</tbody></table>';

      let feeTable = '<table><thead><tr><th>Year</th><th>Inst.</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>';
      if (fees.length > 0) {
        fees.forEach(f => {
          feeTable += `<tr><td>${f.academicYear}</td><td>${f.installmentNumber}</td><td>₹${f.amountPaid}</td><td>₹${f.remainingBalance}</td><td>${f.verificationStatus}</td></tr>`;
        });
      } else {
        feeTable += '<tr><td colspan="5">No fee records</td></tr>';
      }
      feeTable += '</tbody></table>';
      
        const combined = [
          ...technical.map(t => ({ 
            date: t.activityDate, 
            type: t.type === 'Co-curricular' ? 'Technical' : (t.type === 'Extra-curricular' ? 'Non-Technical' : t.type), 
            name: t.activityName, 
            status: t.verificationStatus 
          })),
          ...achievements.map(a => ({ 
            date: a.achievementDate, 
            type: a.type || 'Technical', 
            name: a.achievementName, 
            status: a.verificationStatus 
          }))
        ];
        
        // Group and label activities correctly
        const activitiesTable = `
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Activity/Achievement Name</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${combined.length > 0 ? combined.map(a => `
                <tr>
                  <td><strong>${a.type}</strong></td>
                  <td>${a.name}</td>
                  <td>${a.date}</td>
                  <td class="status-${(a.status || 'Pending').toLowerCase()}">${a.status || 'Pending'}</td>
                </tr>
              `).join('') : '<tr><td colspan="4" style="text-align:center">No records found</td></tr>'}
            </tbody>
          </table>
        `;

      const internshipsTable = `<table><thead><tr><th>Company</th><th>Role</th><th>Status</th></tr></thead><tbody>${internships.length > 0 ? internships.map(i => `<tr><td>${i.companyName}</td><td>${i.role}</td><td>${i.verificationStatus}</td></tr>`).join('') : '<tr><td colspan="3">No records</td></tr>'}</tbody></table>`;

      const dataMap = {
        college_logo_left: b64LogoLeft,
        college_logo_right: b64LogoRight,
        report_title: "Student Academic Progress Report",
        gen_date: new Date().toLocaleDateString(),
        filters_used: `${profile.branch} | ${profile.yearOfStudy} | Div: ${profile.division}`,
        student_photo: b64Photo,
        full_name: profile.fullName.toUpperCase(),
        prn: profile.prn,
        branch: profile.branch,
        year: profile.yearOfStudy,
        division: profile.division,
        dob: profile.dob,
        gender: profile.gender,
        email: profile.email,
        phone: profile.phone,
        aadhar: profile.aadhar,
        category: profile.category,
        permanent_addr: profile.permanentAddress,
        temp_addr: profile.temporaryAddress || profile.permanentAddress,
        father_name: profile.fatherName,
        mother_name: profile.motherName,
        father_phone: profile.fatherPhone || 'N/A',
        annual_income: `₹${profile.annualIncome || '0'}`,
        ssc_school: profile.sscSchool || 'N/A',
        ssc_total: profile.sscMaxMarks ? profile.sscMaxMarks.toString() : 'N/A',
        ssc_obtained: profile.sscMarks ? profile.sscMarks.toString() : 'N/A',
        ssc_perc: profile.sscPercentage ? profile.sscPercentage.toString() : '0',
        hsc_diploma_label: (profile.admissionType === 'DSE' || !!profile.diplomaCollege) ? 'Diploma' : 'HSC (12th)',
        hsc_diploma_college: (profile.admissionType === 'DSE' || !!profile.diplomaCollege) ? (profile.diplomaCollege || 'N/A') : (profile.hscCollege || 'N/A'),
        hsc_diploma_total: (profile.admissionType === 'DSE' || !!profile.diplomaCollege) ? (profile.diplomaMaxMarks || 'N/A') : (profile.hscMaxMarks || 'N/A'),
        hsc_diploma_obtained: (profile.admissionType === 'DSE' || !!profile.diplomaCollege) ? (profile.diplomaMarks || 'N/A') : (profile.hscMarks || 'N/A'),
        hsc_diploma_perc: (profile.admissionType === 'DSE' || !!profile.diplomaCollege) ? (profile.diplomaPercentage || '0') : (profile.hscPercentage || '0'),
        sgpa: academicRecords.length > 0 ? academicRecords[academicRecords.length - 1].sgpa.toString() : 'N/A',
        cgpa: academicRecords.length > 0 ? academicRecords[academicRecords.length - 1].cgpa.toString() : 'N/A',
        total_fee: fees.length > 0 ? (fees[0].totalFee || 0).toString() : '0',
        paid_fee: totalPaid.toString(),
        balance_fee: lastBalance.toString(),
        academic_table: academicTable,
        fee_table: feeTable,
        activities_table: activitiesTable,
        internships_table: internshipsTable,
        view_receipt_btn: '',
        view_certificate_btn: ''
      };

      setHtmlContent(populateTemplate(dataMap, false));

    } catch (e) {
      console.error(e);
    } finally {
      setTemplateLoading(false);
    }
  };


  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (viewMode === 'template' && !htmlContent) {
      loadTemplateData();
    }
  }, [viewMode, profile]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to logout?')) {
        performLogout();
      }
    } else {
      Alert.alert('Logout', 'Are you sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: performLogout
        }
      ]);
    }
  };

  const performLogout = async () => {
    try {
      await logout();
      router.replace('/' as any);
    } catch (error) {
      if (Platform.OS === 'web') {
        alert('Failed to logout');
      } else {
        Alert.alert('Error', 'Failed to logout');
      }
    }
  };

  const modules = [
    {
      id: 'academic-records',
      title: 'Academic Records',
      icon: '📊',
      color: '#FF9800',
      route: '/student/academic-records'
    },
    {
      id: 'fees',
      title: 'Fee Payments',
      icon: '💳',
      color: '#4CAF50',
      route: '/student/fee-payments'
    },
    {
      id: 'activities',
      title: 'Activities',
      icon: '🚀',
      color: '#2196F3',
      route: '/student/activities'
    },
    {
      id: 'achievements',
      title: 'Achievements',
      icon: '🎖️',
      color: '#9C27B0',
      route: '/student/achievements'
    },
    {
      id: 'internships',
      title: 'Internships',
      icon: '💼',
      color: '#F44336',
      route: '/student/internships'
    },
    {
      id: 'documents',
      title: 'Documents',
      icon: '📄',
      color: '#607D8B',
      route: '/student/documents'
    }
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorEmoji}>😕</Text>
        <Text style={styles.errorText}>No profile data found</Text>
        <TouchableOpacity
          style={styles.completeProfileButton}
          onPress={() => router.push('/student/personal-info' as any)}
        >
          <Text style={styles.completeProfileText}>Complete Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header with Profile Button */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => setProfileModalVisible(true)}
          >
            <Image
              source={{
                uri: profile.photoUri || 'https://via.placeholder.com/120'
              }}
              style={styles.profileImage}
            />
            <View style={styles.profileOverlay}>
              <Ionicons name="eye" size={24} color="#fff" />
            </View>
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text style={styles.welcomeText}>Welcome Back!</Text>
            <Text style={styles.studentName}>{profile.fullName || 'Student'}</Text>
            <Text style={styles.studentPrn}>PRN: {profile.prn}</Text>
          </View>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Quick Info Cards */}
        <View style={styles.quickInfoContainer}>
          <View style={styles.quickInfoCard}>
            <Text style={styles.quickInfoLabel}>Branch</Text>
            <Text style={styles.quickInfoValue}>{profile.branch || 'N/A'}</Text>
          </View>
          <View style={styles.quickInfoCard}>
            <Text style={styles.quickInfoLabel}>Category</Text>
            <Text style={styles.quickInfoValue}>{profile.category || 'N/A'}</Text>
          </View>
        </View>

        {/* Modules Grid */}
        <View style={styles.modulesContainer}>
          <Text style={styles.sectionTitle}>Modules</Text>
          <View style={styles.modulesGrid}>
            {modules.map((module) => (
              <TouchableOpacity
                key={module.id}
                style={[styles.moduleCard, { borderLeftColor: module.color }]}
                onPress={() => router.push(module.route as any)}
              >
                <Text style={styles.moduleIcon}>{module.icon}</Text>
                <Text style={styles.moduleTitle}>{module.title}</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Edit Profile Button */}
        <TouchableOpacity
          style={styles.editProfileButton}
          onPress={() => router.push('/student/personal-info' as any)}
        >
          <Ionicons name="create-outline" size={20} color="#fff" />
          <Text style={styles.editProfileText}>Edit Profile</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Last updated: {profile.lastUpdated ? new Date(profile.lastUpdated).toLocaleDateString() : 'Never'}
          </Text>
        </View>
      </ScrollView>

      {/* Profile View Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={profileModalVisible}
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setProfileModalVisible(false)}>
              <Ionicons name="close" size={28} color="#007AFF" />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.modalTitle}>Student Profile Preview</Text>
              <View style={{ flexDirection: 'row', gap: 15, marginTop: 10 }}>
                <TouchableOpacity 
                  onPress={() => setViewMode('template')} 
                  style={{ borderBottomWidth: 2, borderBottomColor: viewMode === 'template' ? COLORS.primary : 'transparent', paddingBottom: 4 }}
                >
                  <Text style={{ color: viewMode === 'template' ? COLORS.primary : COLORS.textLight, fontWeight: 'bold' }}>Template View</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setViewMode('details')} 
                  style={{ borderBottomWidth: 2, borderBottomColor: viewMode === 'details' ? COLORS.primary : 'transparent', paddingBottom: 4 }}
                >
                  <Text style={{ color: viewMode === 'details' ? COLORS.primary : COLORS.textLight, fontWeight: 'bold' }}>Data View</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {viewMode === 'template' ? (
              isWeb ? (
                <View style={{ padding: 20, alignItems: 'center', backgroundColor: '#f5f5f5' }}>
                  {templateLoading ? (
                    <View style={{ height: 300, justifyContent: 'center' }}>
                      <ActivityIndicator size="large" color={COLORS.primary} />
                      <Text style={{ marginTop: 10, color: '#666' }}>Generating Preview...</Text>
                    </View>
                  ) : (
                    <div 
                      style={{ 
                        backgroundColor: 'white',
                        boxShadow: '0 0 10px rgba(0,0,0,0.1)',
                        width: '210mm',
                        minHeight: '297mm',
                        transform: width < 900 ? `scale(${width / 1000})` : 'none',
                        transformOrigin: 'top center'
                      }}
                      dangerouslySetInnerHTML={{ __html: htmlContent }}
                    />
                  )}
                </View>
              ) : (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Ionicons name="desktop-outline" size={64} color="#ccc" />
                  <Text style={{ marginTop: 20, textAlign: 'center', color: '#666', fontSize: 16 }}>
                    The professional template view is optimized for Desktop/Web.
                  </Text>
                  <TouchableOpacity 
                    style={[styles.completeProfileButton, { marginTop: 20, backgroundColor: COLORS.secondary }]}
                    onPress={() => setViewMode('details')}
                  >
                    <Text style={styles.completeProfileText}>Switch to Data View</Text>
                  </TouchableOpacity>
                </View>
              )
            ) : (
              <>
                {/* Profile Image */}
                <View style={styles.modalProfileSection}>
                  <Image
                    source={{
                      uri: profile.photoUri || 'https://via.placeholder.com/150'
                    }}
                    style={styles.modalProfileImage}
                  />
                  <Text style={styles.modalProfileName}>{profile.fullName}</Text>
                  <Text style={styles.modalProfilePrn}>PRN: {profile.prn}</Text>
                  <View style={[styles.statusBadge, profile.verificationStatus === 'Verified' ? styles.verifiedBadge : (profile.verificationStatus === 'Rejected' ? styles.rejectedBadge : styles.pendingBadge)]}>
                    <Text style={[styles.statusBadgeText, { color: profile.verificationStatus === 'Verified' ? '#2E7D32' : (profile.verificationStatus === 'Rejected' ? '#C62828' : '#EF6C00') }]}>
                      {profile.verificationStatus || 'Pending'}
                    </Text>
                  </View>
                </View>

                {/* Personal Information */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Personal Information</Text>
                  <ProfileRow label="Full Name" value={profile.fullName} />
                  <ProfileRow label="Gender" value={profile.gender} />
                  <ProfileRow label="Date of Birth" value={profile.dob} />
                  <ProfileRow label="Religion" value={profile.religion} />
                  <ProfileRow label="Category" value={profile.category} />
                  <ProfileRow label="Caste" value={profile.caste} />
                </View>

                {/* Contact Information */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Contact Information</Text>
                  <ProfileRow label="Phone Number" value={profile.phone} />
                  <ProfileRow label="Email ID" value={profile.email} />
                  <ProfileRow label="Aadhaar Number" value={profile.aadhar} />
                </View>

                {/* Address */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Address</Text>
                  <ProfileRow label="Permanent Address" value={profile.permanentAddress} />
                  <ProfileRow label="Pincode" value={profile.pincode} />
                  {profile.temporaryAddress && (
                    <ProfileRow label="Temporary Address" value={profile.temporaryAddress} />
                  )}
                </View>

                {/* Family Details */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Family Details</Text>
                  <ProfileRow label="Father/Guardian Name" value={profile.fatherName} />
                  <ProfileRow label="Father's Occupation" value={profile.fatherOccupation} />
                  <ProfileRow label="Father's Phone" value={profile.fatherPhone} />
                  <ProfileRow label="Mother's Name" value={profile.motherName} />
                  <ProfileRow label="Mother's Occupation" value={profile.motherOccupation} />
                  <ProfileRow label="Mother's Phone" value={profile.motherPhone} />
                  <ProfileRow label="Annual Income" value={`₹${profile.annualIncome}`} />
                </View>

                {/* Academic Details */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Academic Details</Text>
                  <ProfileRow label="Branch" value={profile.branch} />
                  <ProfileRow label="Year of Study" value={profile.yearOfStudy} />
                  <ProfileRow label="Division" value={profile.division} />
                  <ProfileRow label="Admission Type" value={profile.admissionType} />
                  {profile.jeePercentile && (
                    <ProfileRow label="JEE Percentile" value={profile.jeePercentile} />
                  )}
                  {profile.mhtCetPercentile && (
                    <ProfileRow label="MHT-CET Percentile" value={profile.mhtCetPercentile} />
                  )}
                </View>
              </>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Modal Footer */}
          <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: '#eee', flexDirection: 'row', justifyContent: 'center', gap: 15 }}>
            <TouchableOpacity 
              style={[styles.editProfileButton, { marginHorizontal: 0, marginTop: 0, flex: 1, backgroundColor: COLORS.secondary }]}
              onPress={downloadReport}
            >
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={styles.editProfileText}>Download PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.editProfileButton, { marginHorizontal: 0, marginTop: 0, flex: 1 }]}
              onPress={() => {
                setProfileModalVisible(false);
                router.push('/student/personal-info' as any);
              }}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={styles.editProfileText}>Edit Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const ProfileRow: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
  <View style={styles.profileRow}>
    <Text style={styles.profileRowLabel}>{label}</Text>
    <Text style={styles.profileRowValue}>{value || 'N/A'}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    padding: 24
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 16
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 24
  },
  completeProfileButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12
  },
  completeProfileText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  header: {
    backgroundColor: '#007AFF',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    flexDirection: 'row',
    alignItems: 'center'
  },
  profileButton: {
    position: 'relative'
  },
  profileImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: '#fff'
  },
  profileOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16
  },
  welcomeText: {
    fontSize: 14,
    color: '#e0e0e0',
    marginBottom: 4
  },
  studentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2
  },
  studentPrn: {
    fontSize: 13,
    color: '#e0e0e0'
  },
  logoutButton: {
    padding: 8
  },
  quickInfoContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12
  },
  quickInfoCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3
  },
  quickInfoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4
  },
  quickInfoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333'
  },
  modulesContainer: {
    padding: 20
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16
  },
  modulesGrid: {
    gap: 12
  },
  moduleCard: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3
  },
  moduleIcon: {
    fontSize: 32,
    marginRight: 16
  },
  moduleTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    marginHorizontal: 20,
    marginTop: 10,
    padding: 16,
    borderRadius: 12,
    gap: 8
  },
  editProfileText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  footer: {
    padding: 20,
    alignItems: 'center'
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic'
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
  },
  modalContent: {
    flex: 1
  },
  modalProfileSection: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#f5f7fa'
  },
  modalProfileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#007AFF',
    marginBottom: 16
  },
  modalProfileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4
  },
    modalProfilePrn: {
      fontSize: 14,
      color: '#666'
    },
    statusBadge: {
      marginTop: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 15,
    },
    verifiedBadge: {
      backgroundColor: '#E8F5E9',
    },
    rejectedBadge: {
      backgroundColor: '#FFEBEE',
    },
    pendingBadge: {
      backgroundColor: '#FFF3E0',
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: '#4CAF50', // Default green, will override in badge specific if needed or just use these
    },
  modalSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 12
  },
  profileRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5'
  },
  profileRowLabel: {
    flex: 1,
    fontSize: 14,
    color: '#666'
  },
  profileRowValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    textAlign: 'right'
  }
});