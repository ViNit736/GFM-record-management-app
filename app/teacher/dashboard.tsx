import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  AttendanceRecord,
  AttendanceSession,
  CourseDef,
  createAttendanceSession,
  getAcademicRecordsByStudent,
  getAchievements,
  getAchievementsByFilter,
  getAllActivitiesByFilter,
  getAllCoursesDef,
  getAllInternshipsByFilter,
  getAllStudents,
  getAttendanceRecords,
  getDistinctYearsOfStudy,
  getFeeAnalytics,
  getFeePayments,
  getFeePaymentsByFilter,
  getInternships,
  getStudentActivities,
  getStudentsByDivision,
  getStudentsByRbtRange,
  getTeacherBatchConfig,
  saveAcademicRecord,
  saveAttendanceRecords,
  saveCourseDef,
  saveStudentInfo,
  saveTeacherBatchConfig,
  Student,
  TeacherBatchConfig,
  toCamelCase,
  updateVerificationStatus
} from '../../storage/sqlite';

import { COLORS } from '../../constants/colors';
import { BRANCH_MAPPINGS, getFullBranchName, getFullYearName, YEAR_MAPPINGS } from '../../constants/Mappings';
import { clearSession, getSession } from '../../services/session.service';
import { getStudentsForGFM, logCommunication } from '../../services/student.service';
import { supabase } from '../../services/supabase';
import { generatePDF } from '../../utils/pdf-generator';
const isWeb = Platform.OS === 'web';

// Correct local assets
const LOGO_LEFT_IMG = require('../../assets/images/left.png');
const LOGO_RIGHT_IMG = require('../../assets/images/right.jpeg');

// Fallback placeholders if assets are missing or in non-web environments
const FALLBACK_LOGO = "https://via.placeholder.com/80?text=LOGO";

// Helper to convert Image URL to Base64 with timeout and error handling
const getBase64Image = (source: any, timeout = 5000): Promise<string> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !source) return resolve('');

    // If it's a string and starts with data:
    if (typeof source === 'string' && source.startsWith('data:')) return resolve(source);

    // If it's a require() or asset number, we need to resolve it
    let url = typeof source === 'string' ? source : Image.resolveAssetSource(source)?.uri;

    if (!url) return resolve('');

    const img = document.createElement('img');
    img.setAttribute('crossOrigin', 'anonymous');

    const timer = setTimeout(() => {
      img.src = ""; // Stop loading
      resolve(url || ''); // Return original URL as fallback
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
        resolve(url || '');
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(url?.includes('supabase.co') ? FALLBACK_LOGO : (url || ''));
    };
    img.src = url;
  });
};

const handleViewDocument = (uri: string) => {
  if (!uri) return;
  const isPdf = uri.toLowerCase().endsWith('.pdf') || uri.includes('/raw/upload/');
  if (isPdf) {
    if (isWeb) {
      window.open(uri, '_blank');
    } else {
      Linking.openURL(uri).catch(err => {
        console.error("Error opening PDF:", err);
        Alert.alert("Error", "Could not open PDF. Please try again.");
      });
    }
  } else {
    // For images, we could use a modal, but opening in a new tab is also fine for teacher dashboard
    if (isWeb) {
      window.open(uri, '_blank');
    } else {
      Linking.openURL(uri).catch(err => {
        console.error("Error opening Image:", err);
        Alert.alert("Error", "Could not open Image. Please try again.");
      });
    }
  }
};

const exportStudentPDF = async (student: Student, options: any, setLoading: (v: boolean) => void) => {
  setLoading(true);

  try {
    const academicRecords = (options.academic || options.all) ? await getAcademicRecordsByStudent(student.prn) : [];
    const fees = (options.fees || options.all) ? await getFeePayments(student.prn) : [];
    const technical = (options.activities || options.all) ? await getStudentActivities(student.prn) : [];
    const achievements = (options.activities || options.all) ? await getAchievements(student.prn) : [];
    const internships = (options.internships || options.all) ? await getInternships(student.prn) : [];

    let totalPaid = 0;
    let lastBalance = 0;
    fees.forEach(f => {
      totalPaid += (f.amountPaid || 0);
      lastBalance = f.remainingBalance || 0;
    });

    // Generate Academic Table HTML
    let academicTableHtml = '<table><thead><tr><th>Sem</th><th>Code</th><th>Course</th><th>MSE</th><th>ESE</th><th>Grade</th></tr></thead><tbody>';
    if (academicRecords.length > 0) {
      academicRecords.forEach(r => {
        academicTableHtml += `<tr><td>${r.semester}</td><td>${r.courseCode}</td><td>${r.courseName}</td><td>${r.mseMarks || 0}</td><td>${r.eseMarks || 0}</td><td style="color: ${r.grade === 'F' ? COLORS.error : 'inherit'}">${r.grade}</td></tr>`;
      });
    } else {
      academicTableHtml += '<tr><td colspan="6" style="text-align: center;">No academic records found</td></tr>';
    }
    academicTableHtml += '</tbody></table>';

    // Generate Fee Table HTML
    let feeTableHtml = '<table><thead><tr><th>Year</th><th>Inst.</th><th>Date</th><th>Paid</th><th>Balance</th><th>Mode</th></tr></thead><tbody>';
    if (fees.length > 0) {
      fees.forEach(f => {
        feeTableHtml += `<tr><td>${f.academicYear}</td><td>${f.installmentNumber}</td><td>${f.paymentDate}</td><td>₹${f.amountPaid}</td><td>₹${f.remainingBalance}</td><td>${f.paymentMode}</td></tr>`;
      });
    } else {
      feeTableHtml += '<tr><td colspan="6" style="text-align: center;">No fee records found</td></tr>';
    }
    feeTableHtml += '</tbody></table>';

    // Generate Activities Table HTML
    let activitiesTableHtml = `
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Activity Name</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
    `;
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
    if (combined.length > 0) {
      combined.forEach(a => {
        activitiesTableHtml += `
          <tr>
            <td><strong>${a.type}</strong></td>
            <td>${a.name}</td>
            <td>${a.date}</td>
            <td class="status-${(a.status || 'Pending').toLowerCase()}">${a.status || 'Pending'}</td>
          </tr>
        `;
      });
    } else {
      activitiesTableHtml += '<tr><td colspan="4" style="text-align: center;">No activities found</td></tr>';
    }
    activitiesTableHtml += '</tbody></table>';

    // Generate Internships Table HTML
    let internshipsTableHtml = '<table><thead><tr><th>Company</th><th>Role</th><th>Duration</th><th>Type</th></tr></thead><tbody>';
    if (internships.length > 0) {
      internships.forEach(i => {
        internshipsTableHtml += `<tr><td>${i.companyName}</td><td>${i.role}</td><td>${i.duration}m</td><td>${i.internshipType}</td></tr>`;
      });
    } else {
      internshipsTableHtml += '<tr><td colspan="4" style="text-align: center;">No internships found</td></tr>';
    }
    internshipsTableHtml += '</tbody></table>';

    const lastReceipt = fees.find(f => f.receiptUri);
    const viewReceiptBtn = lastReceipt ? `<a href="${lastReceipt.receiptUri}" class="action-link" target="_blank">View Latest Receipt →</a>` : '';
    const lastCertificate = [...technical, ...internships].find(x => x.certificateUri);
    const viewCertBtn = lastCertificate ? `<a href="${lastCertificate.certificateUri}" class="action-link" target="_blank">View Certificates →</a>` : '';

    const b64LogoLeft = await getBase64Image(LOGO_LEFT_IMG);
    const b64LogoRight = await getBase64Image(LOGO_RIGHT_IMG);
    const b64StudentPhoto = await getBase64Image(student.photoUri || 'https://via.placeholder.com/150');

    const dataMap = {
      college_logo_left: b64LogoLeft,
      college_logo_right: b64LogoRight,
      report_title: options.all ? "Comprehensive Student Profile" : "Student Academic Report",
      gen_date: new Date().toLocaleString(),
      filters_used: `Dept: ${student.branch} | Year: ${student.yearOfStudy} | Div: ${student.division}`,
      student_photo: b64StudentPhoto,
      full_name: (student.fullName || '').toUpperCase(),
      prn: student.prn || '',
      branch: student.branch || '',
      year: student.yearOfStudy || '',
      division: student.division || '',
      dob: student.dob || '',
      gender: student.gender || '',
      email: student.email || '',
      phone: student.phone || '',
      aadhar: student.aadhar || '',
      category: student.category || '',
      permanent_addr: student.permanentAddress || '',
      temp_addr: student.temporaryAddress || student.permanentAddress || '',
      father_name: student.fatherName || '',
      mother_name: student.motherName || '',
      father_phone: student.fatherPhone || 'N/A',
      annual_income: `₹${student.annualIncome || '0'}`,
      ssc_school: student.sscSchool || 'N/A',
      ssc_total: student.sscMaxMarks ? student.sscMaxMarks.toString() : 'N/A',
      ssc_obtained: student.sscMarks ? student.sscMarks.toString() : 'N/A',
      ssc_perc: student.sscPercentage ? student.sscPercentage.toString() : '0',
      hsc_diploma_label: (student.admissionType === 'DSE' || !!student.diplomaCollege) ? 'Diploma' : 'HSC (12th)',
      hsc_diploma_college: (student.admissionType === 'DSE' || !!student.diplomaCollege) ? (student.diplomaCollege || 'N/A') : (student.hscCollege || 'N/A'),
      hsc_diploma_total: (student.admissionType === 'DSE' || !!student.diplomaCollege) ? (student.diplomaMaxMarks || 'N/A') : (student.hscMaxMarks || 'N/A'),
      hsc_diploma_obtained: (student.admissionType === 'DSE' || !!student.diplomaCollege) ? (student.diplomaMarks || 'N/A') : (student.hscMarks || 'N/A'),
      hsc_diploma_perc: (student.admissionType === 'DSE' || !!student.diplomaCollege) ? (student.diplomaPercentage || '0') : (student.hscPercentage || '0'),
      sgpa: academicRecords.length > 0 ? academicRecords[academicRecords.length - 1].sgpa?.toString() || 'N/A' : 'N/A',
      cgpa: academicRecords.length > 0 ? academicRecords[academicRecords.length - 1].cgpa?.toString() || 'N/A' : 'N/A',
      total_fee: fees.length > 0 ? (fees[0].totalFee || 0).toString() : '0',
      paid_fee: totalPaid.toString(),
      balance_fee: lastBalance.toString(),
      academic_table: academicTableHtml,
      fee_table: feeTableHtml,
      activities_table: activitiesTableHtml,
      internships_table: internshipsTableHtml,
      view_receipt_btn: viewReceiptBtn,
      view_certificate_btn: viewCertBtn
    };

    const htmlContent = populateTemplate(dataMap, false);

    await generatePDF({
      fileName: `${student.prn}_Academic_Report_${new Date().getTime()}.pdf`,
      data: student,
      htmlTemplate: htmlContent
    });

    setLoading(false);
  } catch (error) {
    console.error('Error generating PDF:', error);
    Alert.alert('Error', 'Failed to generate PDF. Please check your connection and try again.');
    setLoading(false);
  }
};

type Module = 'courses' | 'students' | 'academic' | 'fee' | 'activities' | 'achievements' | 'internships' | 'analytics' | 'attendance' | 'attendance-summary';

export default function TeacherDashboard() {
  const { width } = useWindowDimensions();
  const [currentModule, setCurrentModule] = useState<Module>('analytics');
  const [activeModuleGroup, setActiveModuleGroup] = useState<'Attendance' | 'GFM'>('Attendance');
  const [loading, setLoading] = useState(true);
  const [teacherPrn, setTeacherPrn] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [teacherDept, setTeacherDept] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<CourseDef[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState<Student | null>(null);
  const [selectedStudentForAcademicView, setSelectedStudentForAcademicView] = useState<Student | null>(null);
  const [studentForPrint, setStudentForPrint] = useState<Student | null>(null);
  const [printOptionsVisible, setPrintOptionsVisible] = useState(false);
  const [printOptions, setPrintOptions] = useState({
    personal: true,
    academic: false,
    fees: false,
    activities: false,
    internships: false,
    all: false,
  });

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSection, setEditingSection] = useState<string>('');
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [editData, setEditData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  const openQuickEdit = (student: Student, section: string) => {
    setEditingStudent(student);
    setEditingSection(section);
    setEditData({ ...student });
    setEditModalVisible(true);
  };

  const handleQuickSave = async () => {
    setIsSaving(true);
    try {
      await saveStudentInfo(editData);
      Alert.alert('Success', `${editingSection} updated successfully`);
      setEditModalVisible(false);
      loadData();
      // Update the details modal student if it's open
      if (selectedStudentForDetails && selectedStudentForDetails.prn === editData.prn) {
        setSelectedStudentForDetails(editData);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to update student information');
    } finally {
      setIsSaving(false);
    }
  };

  const Checkbox = ({ label, value, onValueChange, disabled = false }: { label: string, value: boolean, onValueChange: (v: boolean) => void, disabled?: boolean }) => (
    <TouchableOpacity
      style={[styles.checkboxContainer, disabled && { opacity: 0.5 }]}
      onPress={() => !disabled && onValueChange(!value)}
    >
      <Ionicons name={value ? "checkbox" : "square-outline"} size={22} color={value ? COLORS.secondary : COLORS.textLight} />
      <Text style={styles.checkboxLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const PrintOptionsModal = () => (
    <Modal visible={printOptionsVisible} transparent animationType="fade" onRequestClose={() => setPrintOptionsVisible(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBody, { maxWidth: 450 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>PDF Report Options</Text>
            <TouchableOpacity onPress={() => setPrintOptionsVisible(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.helperText, { marginBottom: 20 }]}>Select modules to include in the report for {studentForPrint?.fullName}</Text>

          <View style={{ marginBottom: 20 }}>
            <Checkbox label="Personal Details (Always included)" value={true} onValueChange={() => { }} disabled={true} />
            <Checkbox label="Academic Performance" value={printOptions.academic || printOptions.all} onValueChange={(v) => setPrintOptions({ ...printOptions, academic: v, all: false })} />
            <Checkbox label="Fee Payment Details" value={printOptions.fees || printOptions.all} onValueChange={(v) => setPrintOptions({ ...printOptions, fees: v, all: false })} />
            <Checkbox label="Activities & Achievements" value={printOptions.activities || printOptions.all} onValueChange={(v) => setPrintOptions({ ...printOptions, activities: v, all: false })} />
            <Checkbox label="Internship Details" value={printOptions.internships || printOptions.all} onValueChange={(v) => setPrintOptions({ ...printOptions, internships: v, all: false })} />
            <View style={{ height: 1, backgroundColor: '#eee', marginVertical: 10 }} />
            <Checkbox label="Select All Modules" value={printOptions.all} onValueChange={(v) => setPrintOptions({
              personal: true, academic: v, fees: v, activities: v, internships: v, all: v
            })} />
          </View>

          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => setPrintOptionsVisible(false)}>
              <Text style={[styles.btnText, { color: COLORS.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.saveBtn]}
              onPress={() => {
                if (studentForPrint) {
                  exportStudentPDF(studentForPrint, printOptions, setLoading);
                  setPrintOptionsVisible(false);
                }
              }}
            >
              <Ionicons name="print-outline" size={20} color="#fff" />
              <Text style={[styles.btnText, { marginLeft: 8 }]}>Generate PDF</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const [gfmDeptFilter, setGfmDeptFilter] = useState('All');
  const [gfmYearFilter, setGfmYearFilter] = useState('All');
  const [gfmDivFilter, setGfmDivFilter] = useState('All');

  const [attDeptFilter, setAttDeptFilter] = useState('All');
  const [attYearFilter, setAttYearFilter] = useState('All');
  const [attDivFilter, setAttDivFilter] = useState('All');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<Student[]>([]);
  const [semFilter, setSemFilter] = useState<number | 'All'>('All');
  const [activityTypeFilter, setActivityTypeFilter] = useState<'All' | 'Extra-curricular' | 'Co-curricular' | 'Courses'>('All');

  // Search suggestions logic
  useEffect(() => {
    if (searchQuery.length >= 2 && students.length > 0) {
      const query = searchQuery.toLowerCase();
      const suggested = students
        .filter(s =>
          s.fullName.toLowerCase().includes(query) ||
          s.prn.toLowerCase().includes(query)
        )
        .slice(0, 5);
      setSearchSuggestions(suggested);
    } else {
      setSearchSuggestions([]);
    }
  }, [searchQuery, students]);

  const router = useRouter();

  const [userRole, setUserRole] = useState('');
  const [yearsOfStudy, setYearsOfStudy] = useState<string[]>([]);

  const handleCall = async (student: Student, callType: 'student' | 'father' | 'mother') => {
    const session = await getSession();
    if (!session) {
      Alert.alert('Error', 'Session expired. Please login again.');
      router.replace('/');
      return;
    }

    let phoneNumber = '';
    let contactPerson = '';

    if (callType === 'student') {
      phoneNumber = student.phone || '';
      contactPerson = student.fullName || 'Student';
    } else if (callType === 'father') {
      phoneNumber = student.fatherPhone || '';
      contactPerson = student.fatherName || 'Father';
    } else if (callType === 'mother') {
      phoneNumber = student.motherPhone || '';
      contactPerson = student.motherName || 'Mother';
    }

    if (!phoneNumber) {
      Alert.alert('No Phone Number', `No phone number available for ${contactPerson}.`);
      return;
    }

    const url = `tel:${phoneNumber}`;
    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
      // Log the communication
      await logCommunication({
        studentPrn: student.prn,
        teacherPrn: session.prn,
        contactType: callType,
        contactPerson: contactPerson,
        phoneNumber: phoneNumber,
        timestamp: new Date().toISOString(),
      });
      Alert.alert('Call Initiated', `Calling ${contactPerson} at ${phoneNumber}`);
    } else {
      Alert.alert('Call Failed', `Could not initiate call to ${phoneNumber}. Please dial manually.`);
    }
  };

  useEffect(() => {
    const init = async () => {
      await checkAuth();
      await loadMetadata();
      await loadData();
    };
    init();

    // Set up Realtime Subscriptions
    const channel = supabase
      .channel('teacher-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_activities' }, () => {
        console.log('Realtime update: student_activities');
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'achievements' }, () => {
        console.log('Realtime update: achievements');
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fee_payments' }, () => {
        console.log('Realtime update: fee_payments');
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internships' }, () => {
        console.log('Realtime update: internships');
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
        console.log('Realtime update: students');
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gfmDeptFilter, gfmYearFilter, gfmDivFilter, attDeptFilter, attYearFilter, attDivFilter, searchQuery, currentModule, semFilter, activityTypeFilter]);

  const loadMetadata = async () => {
    const years = await getDistinctYearsOfStudy();
    setYearsOfStudy(years);
  };

  const checkAuth = async () => {
    const session = await getSession();
    if (!session || (session.role !== 'teacher' && session.role !== 'admin')) {
      router.replace('/');
    } else {
      setTeacherPrn(session.prn);
      setTeacherName(session.fullName || '');
      setTeacherDept(session.department || '');
      setUserRole(session.role);

      // If teacher, lock them into their department for both filter sets
      if (session.role === 'teacher' && session.department) {
        setGfmDeptFilter(session.department);
        setAttDeptFilter(session.department);
      }
    }
  };

  const loadData = async () => {
    const session = await getSession();
    if (!session) return;

    setLoading(true);
    try {
      const allStudents = await getAllStudents();
      setStudents(allStudents);

      const isAttendance = activeModuleGroup === 'Attendance';
      const activeDept = isAttendance ? attDeptFilter : gfmDeptFilter;
      const activeYear = isAttendance ? attYearFilter : gfmYearFilter;
      const activeDiv = isAttendance ? attDivFilter : gfmDivFilter;

      let filtered: Student[] = [];

      // Strict department/batch filtering for teachers
      if (session.role === 'teacher') {
        // Use the new service that strictly respects batch config using UUID from session
        filtered = await getStudentsForGFM(session.id);

        // Lock filters to what we found
        if (filtered.length > 0) {
          const sample = filtered[0];
          setGfmDeptFilter(sample.branch);
          setGfmYearFilter(sample.yearOfStudy);
          setGfmDivFilter(sample.division);
          setTeacherDept(sample.branch);
        }
      } else {
        // Admin can see everything
        filtered = await getAllStudents();

        if (activeDept !== 'All') {
          filtered = filtered.filter(s => s.branch === activeDept);
        }
        if (activeYear !== 'All') filtered = filtered.filter(s => s.yearOfStudy === activeYear);
        if (activeDiv !== 'All') filtered = filtered.filter(s => s.division === activeDiv);
      }

      setStudents(filtered); // Update main list too so we don't re-fetch unnecessarily

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(s =>
          s.fullName.toLowerCase().includes(query) ||
          s.prn.toLowerCase().includes(query)
        );
      }

      setFilteredStudents(filtered);

      if (currentModule === 'courses') {
        const c = await getAllCoursesDef();
        let filteredCourses = c;

        const targetDept = session.role === 'teacher' ? session.department : activeDept;
        if (targetDept && targetDept !== 'All') {
          filteredCourses = filteredCourses.filter(course => course.department === targetDept);
        }

        if (semFilter !== 'All') {
          filteredCourses = filteredCourses.filter(course => course.semester === semFilter);
        }

        if (searchQuery) {
          const query = searchQuery.toLowerCase().trim();
          const semMatch = query.match(/sem\s*(\d)/);
          if (semMatch) {
            const semNum = parseInt(semMatch[1]);
            filteredCourses = filteredCourses.filter(course => course.semester === semNum);
          } else {
            filteredCourses = filteredCourses.filter(course =>
              course.courseCode.toLowerCase().includes(query) ||
              course.courseName.toLowerCase().includes(query)
            );
          }
        }
        setCourses(filteredCourses);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (table: any, id: any, status: 'Verified' | 'Rejected') => {
    try {
      await updateVerificationStatus(table, id, status, teacherPrn);
      Alert.alert('Success', `Record ${status} successfully`);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const SidebarItem = ({ title, icon, module }: { title: string, icon: any, module: Module }) => {
    return (
      <TouchableOpacity
        style={[styles.sidebarItem, currentModule === module && styles.sidebarItemActive]}
        onPress={() => setCurrentModule(module)}
      >
        <Ionicons name={icon} size={24} color={currentModule === module ? '#fff' : COLORS.textLight} />
        {width > 800 && <Text style={[styles.sidebarText, currentModule === module && styles.sidebarTextActive]}>{title}</Text>}
      </TouchableOpacity>
    );
  };

  const renderHeader = () => {
    return (
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.collegeName}>GFM Record</Text>
          <Text style={styles.tagline}>{userRole === 'admin' ? 'Management Portal' : 'Faculty Portal'}</Text>
        </View>
        <TouchableOpacity onPress={async () => { await clearSession(); router.replace('/'); }} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFilters = () => {
    const isAttendance = activeModuleGroup === 'Attendance';
    const deptValue = isAttendance ? attDeptFilter : gfmDeptFilter;
    const setDeptValue = isAttendance ? setAttDeptFilter : setGfmDeptFilter;
    const yearValue = isAttendance ? attYearFilter : gfmYearFilter;
    const setYearValue = isAttendance ? setAttYearFilter : setGfmYearFilter;
    const divValue = isAttendance ? attDivFilter : gfmDivFilter;
    const setDivValue = isAttendance ? setAttDivFilter : setGfmDivFilter;

    return (
      <View style={styles.filterContainer}>
        <View style={styles.filterItem}>
          <Text style={styles.filterLabel}>Department</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={deptValue}
              onValueChange={setDeptValue}
              style={styles.picker}
              enabled={userRole === 'admin'}
            >
              <Picker.Item label="All" value="All" />
              {Object.keys(BRANCH_MAPPINGS).map(key => (
                <Picker.Item key={key} label={BRANCH_MAPPINGS[key]} value={key} />
              ))}
            </Picker>
          </View>
        </View>
        <View style={styles.filterItem}>
          <Text style={styles.filterLabel}>Year</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={yearValue}
              onValueChange={setYearValue}
              style={styles.picker}
            >
              <Picker.Item label="All" value="All" />
              {Object.keys(YEAR_MAPPINGS).map(key => (
                <Picker.Item key={key} label={YEAR_MAPPINGS[key]} value={key} />
              ))}
            </Picker>
          </View>
        </View>
        <View style={styles.filterItem}>
          <Text style={styles.filterLabel}>Division</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={divValue}
              onValueChange={setDivValue}
              style={styles.picker}
            >
              <Picker.Item label="All" value="All" />
              <Picker.Item label="Division A" value="A" />
              <Picker.Item label="A1" value="A1" />
              <Picker.Item label="A2" value="A2" />
              <Picker.Item label="A3" value="A3" />
              <Picker.Item label="Division B" value="B" />
              <Picker.Item label="B1" value="B1" />
              <Picker.Item label="B2" value="B2" />
              <Picker.Item label="B3" value="B3" />
              <Picker.Item label="Division C" value="C" />
              <Picker.Item label="C1" value="C1" />
              <Picker.Item label="C2" value="C2" />
              <Picker.Item label="C3" value="C3" />
            </Picker>
          </View>
        </View>

        {(currentModule === 'courses' || currentModule === 'activities' || currentModule === 'achievements' || currentModule === 'internships') && (
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Semester</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={semFilter}
                onValueChange={(val) => setSemFilter(val === 'All' ? 'All' : Number(val))}
                style={styles.picker}
              >
                <Picker.Item label="All" value="All" />
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                  <Picker.Item key={s} label={`Sem ${s}`} value={s} />
                ))}
              </Picker>
            </View>
          </View>
        )}

        {currentModule === 'activities' && (
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Activity Type</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={activityTypeFilter}
                onValueChange={setActivityTypeFilter}
                style={styles.picker}
              >
                <Picker.Item label="All" value="All" />
                <Picker.Item label="Co-curricular" value="Co-curricular" />
                <Picker.Item label="Extra-curricular" value="Extra-curricular" />
                <Picker.Item label="Courses" value="Courses" />
              </Picker>
            </View>
          </View>
        )}

        <View style={{ flex: 1 }} />

        <View style={[styles.filterItem, { minWidth: 250, zIndex: 100 }]}>
          <View style={[styles.pickerWrapper, { width: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }]}>
            <Ionicons name="search-outline" size={18} color={COLORS.textLight} />
            <TextInput
              placeholder="Search Name or PRN..."
              style={{ flex: 1, height: 35, marginLeft: 8, fontSize: 13 }}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
              </TouchableOpacity>
            )}
          </View>

          {/* Search Suggestions Dropdown */}
          {searchSuggestions.length > 0 && (
            <View style={styles.searchSuggestionsBox}>
              {searchSuggestions.map((student) => (
                <TouchableOpacity
                  key={student.prn}
                  style={styles.searchSuggestionItem}
                  onPress={() => {
                    setSearchQuery(student.fullName);
                    setSearchSuggestions([]);
                    setSelectedStudentForDetails(student);
                  }}
                >
                  <View>
                    <Text style={styles.suggestionName}>{student.fullName}</Text>
                    <Text style={styles.suggestionSub}>{student.prn} • {getFullYearName(student.yearOfStudy)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const QuickEditModal = () => {
    const renderFields = () => {
      switch (editingSection) {
        case 'Personal Information':
          return (
            <View>
              <TextInput style={styles.input} placeholder="Full Name" value={editData.fullName} onChangeText={t => setEditData({ ...editData, fullName: t })} />
              <TextInput style={styles.input} placeholder="DOB (YYYY-MM-DD)" value={editData.dob} onChangeText={t => setEditData({ ...editData, dob: t })} />
              <TextInput style={styles.input} placeholder="Gender" value={editData.gender} onChangeText={t => setEditData({ ...editData, gender: t })} />
              <TextInput style={styles.input} placeholder="Religion" value={editData.religion} onChangeText={t => setEditData({ ...editData, religion: t })} />
              <TextInput style={styles.input} placeholder="Category" value={editData.category} onChangeText={t => setEditData({ ...editData, category: t })} />
              <TextInput style={styles.input} placeholder="Caste" value={editData.caste} onChangeText={t => setEditData({ ...editData, caste: t })} />
              <TextInput style={styles.input} placeholder="Aadhar" value={editData.aadhar} onChangeText={t => setEditData({ ...editData, aadhar: t })} />
            </View>
          );
        case 'Academic Status':
          return (
            <View>
              <TextInput style={styles.input} placeholder="Branch" value={editData.branch} onChangeText={t => setEditData({ ...editData, branch: t })} />
              <TextInput style={styles.input} placeholder="Year" value={editData.yearOfStudy} onChangeText={t => setEditData({ ...editData, yearOfStudy: t })} />
              <TextInput style={styles.input} placeholder="Division" value={editData.division} onChangeText={t => setEditData({ ...editData, division: t })} />
            </View>
          );
        case 'Contact & Address':
          return (
            <View>
              <TextInput style={styles.input} placeholder="Phone" value={editData.phone} onChangeText={t => setEditData({ ...editData, phone: t })} />
              <TextInput style={styles.input} placeholder="Email" value={editData.email} onChangeText={t => setEditData({ ...editData, email: t })} />
              <TextInput style={styles.input} placeholder="Pincode" value={editData.pincode} onChangeText={t => setEditData({ ...editData, pincode: t })} />
              <TextInput style={[styles.input, { height: 80 }]} multiline placeholder="Permanent Address" value={editData.permanentAddress} onChangeText={t => setEditData({ ...editData, permanentAddress: t })} />
              <TextInput style={[styles.input, { height: 80 }]} multiline placeholder="Temporary Address" value={editData.temporaryAddress} onChangeText={t => setEditData({ ...editData, temporaryAddress: t })} />
            </View>
          );
        case 'Family Details':
          return (
            <View>
              <TextInput style={styles.input} placeholder="Father's Name" value={editData.fatherName} onChangeText={t => setEditData({ ...editData, fatherName: t })} />
              <TextInput style={styles.input} placeholder="Mother's Name" value={editData.motherName} onChangeText={t => setEditData({ ...editData, motherName: t })} />
              <TextInput style={styles.input} placeholder="Father's Occupation" value={editData.fatherOccupation} onChangeText={t => setEditData({ ...editData, fatherOccupation: t })} />
              <TextInput style={styles.input} placeholder="Annual Income" value={editData.annualIncome} onChangeText={t => setEditData({ ...editData, annualIncome: t })} />
              <TextInput style={styles.input} placeholder="Father's Phone" value={editData.fatherPhone} onChangeText={t => setEditData({ ...editData, fatherPhone: t })} />
              <TextInput style={styles.input} placeholder="Mother's Phone" value={editData.motherPhone} onChangeText={t => setEditData({ ...editData, motherPhone: t })} />
            </View>
          );
        case 'Education History':
          return (
            <View>
              <TextInput style={styles.input} placeholder="SSC School" value={editData.sscSchool} onChangeText={t => setEditData({ ...editData, sscSchool: t })} />
              <TextInput style={styles.input} placeholder="SSC Marks" value={editData.sscMarks} onChangeText={t => setEditData({ ...editData, sscMarks: t })} />
              <TextInput style={styles.input} placeholder="SSC Max Marks" value={editData.sscMaxMarks} onChangeText={t => setEditData({ ...editData, sscMaxMarks: t })} />
              <TextInput style={styles.input} placeholder="SSC Percentage" value={editData.sscPercentage} onChangeText={t => setEditData({ ...editData, sscPercentage: t })} />
              <View style={{ height: 1, backgroundColor: '#eee', marginVertical: 10 }} />
              <TextInput style={styles.input} placeholder="HSC/Diploma College" value={editData.hscCollege || editData.diplomaCollege} onChangeText={t => setEditData(editData.admissionType === 'DSE' ? { ...editData, diplomaCollege: t } : { ...editData, hscCollege: t })} />
              <TextInput style={styles.input} placeholder="HSC/Diploma Marks" value={editData.hscMarks || editData.diplomaMarks} onChangeText={t => setEditData(editData.admissionType === 'DSE' ? { ...editData, diplomaMarks: t } : { ...editData, hscMarks: t })} />
              <TextInput style={styles.input} placeholder="HSC/Diploma Percentage" value={editData.hscPercentage || editData.diplomaPercentage} onChangeText={t => setEditData(editData.admissionType === 'DSE' ? { ...editData, diplomaPercentage: t } : { ...editData, hscPercentage: t })} />
            </View>
          );
        default: return null;
      }
    };

    return (
      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBody, { maxWidth: 500, maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Quick Edit: {editingSection}</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ paddingBottom: 20 }}>
              {renderFields()}
            </ScrollView>
            <View style={[styles.row, { marginTop: 20 }]}>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleQuickSave} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {renderHeader()}
      <View style={styles.mainContent}>
        <View style={[styles.sidebar, { width: width > 800 ? 220 : 60 }]}>
          {/* Module Group Switcher */}
          <View style={{ padding: 10, gap: 10 }}>
            <TouchableOpacity
              style={[styles.moduleSwitchBtn, activeModuleGroup === 'Attendance' && styles.moduleSwitchBtnActive]}
              onPress={() => {
                setActiveModuleGroup('Attendance');
                setCurrentModule('attendance');
              }}
            >
              <Ionicons name="checkbox-outline" size={20} color={activeModuleGroup === 'Attendance' ? '#fff' : COLORS.textLight} />
              {width > 800 && <Text style={[styles.moduleSwitchText, activeModuleGroup === 'Attendance' && styles.moduleSwitchTextActive]}>Attendance</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.moduleSwitchBtn, activeModuleGroup === 'GFM' && styles.moduleSwitchBtnActive]}
              onPress={() => {
                setActiveModuleGroup('GFM');
                setCurrentModule('students');
              }}
            >
              <Ionicons name="people-outline" size={20} color={activeModuleGroup === 'GFM' ? '#fff' : COLORS.textLight} />
              {width > 800 && <Text style={[styles.moduleSwitchText, activeModuleGroup === 'GFM' && styles.moduleSwitchTextActive]}>GFM Record</Text>}
            </TouchableOpacity>
          </View>

          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 5 }} />

          {activeModuleGroup === 'Attendance' ? (
            <>
              <SidebarItem title="Attendance" icon="checkbox-outline" module="attendance" />
              <SidebarItem title="Summary" icon="list-outline" module="attendance-summary" />
            </>
          ) : (
            <>
              <SidebarItem title="Students" icon="people-outline" module="students" />
              <SidebarItem title="Analytics" icon="analytics-outline" module="analytics" />
              <SidebarItem title="Academic" icon="school-outline" module="academic" />
              <SidebarItem title="Fees" icon="cash-outline" module="fee" />
              <SidebarItem title="Activities" icon="star-outline" module="activities" />
              <SidebarItem title="Achievements" icon="trophy-outline" module="achievements" />
              <SidebarItem title="Internships" icon="briefcase-outline" module="internships" />
              <SidebarItem title="Courses" icon="book-outline" module="courses" />
            </>
          )}
        </View>


        <View style={styles.contentArea}>
          {renderFilters()}
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {loading ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
            ) : (
              <ModuleRenderer
                module={currentModule}
                students={filteredStudents}
                courses={courses}
                yearsOfStudy={yearsOfStudy}
                filters={{
                  dept: activeModuleGroup === 'Attendance' ? attDeptFilter : gfmDeptFilter,
                  year: activeModuleGroup === 'Attendance' ? attYearFilter : gfmYearFilter,
                  div: activeModuleGroup === 'Attendance' ? attDivFilter : gfmDivFilter,
                  sem: semFilter,
                  activityType: activityTypeFilter
                }}
                setSelectedStudentForDetails={setSelectedStudentForDetails}
                setSelectedStudentForAcademicView={setSelectedStudentForAcademicView}
                setStudentForPrint={setStudentForPrint}
                setPrintOptionsVisible={setPrintOptionsVisible}
                handleVerify={handleVerify}
                loadData={loadData}
              />
            )}
          </ScrollView>
        </View>
      </View>

      {selectedStudentForDetails && (
        <StudentDetailsModal
          student={selectedStudentForDetails}
          visible={!!selectedStudentForDetails}
          onClose={() => setSelectedStudentForDetails(null)}
          exportStudentPDF={(s, opt) => exportStudentPDF(s, opt, setLoading)}
        />
      )}
      <PrintOptionsModal />
      {selectedStudentForAcademicView && (
        <AcademicViewModal
          student={selectedStudentForAcademicView}
          visible={!!selectedStudentForAcademicView}
          onClose={() => setSelectedStudentForAcademicView(null)}
        />
      )}
      <QuickEditModal />
    </View>
  );
}

const ModuleRenderer = ({ module, students, courses, yearsOfStudy, filters, setSelectedStudentForDetails, setSelectedStudentForAcademicView, setStudentForPrint, setPrintOptionsVisible, handleVerify, loadData }: any) => {
  if (!filters) return <ActivityIndicator size="small" color={COLORS.primary} />;

  switch (module) {
    case 'analytics': return <AnalyticsManagement students={students} filters={filters} />;
    case 'students': return <StudentManagement
      students={students}
      filters={filters}
      onViewDetails={setSelectedStudentForDetails}
      onPrint={(s: Student) => {
        setStudentForPrint(s);
        setPrintOptionsVisible(true);
      }}
      handleVerify={handleVerify}
    />;
    case 'courses': return <CoursesManagement courses={courses} filters={filters} loadData={loadData} />;
    case 'academic': return <AcademicManagement students={students} filters={filters} onViewDetails={setSelectedStudentForDetails} onViewAcademicDetails={setSelectedStudentForAcademicView} />;
    case 'fee': return <FeeManagement students={students} filters={filters} handleVerify={handleVerify} />;
    case 'activities': return <ActivitiesManagement students={students} filters={filters} handleVerify={handleVerify} />;
    case 'achievements': return <AchievementsManagement students={students} filters={filters} handleVerify={handleVerify} />;
    case 'internships': return <InternshipsManagement students={students} filters={filters} handleVerify={handleVerify} />;


    case 'attendance': return <AttendanceManagement filters={filters} loadData={loadData} />;
    case 'attendance-summary': return <AttendanceSummaryManagement filters={filters} />;
    default: return <Text>Select a module</Text>;
  }
};


const AcademicViewModal = ({ student, visible, onClose }: { student: Student, visible: boolean, onClose: () => void }) => {
  const { width } = useWindowDimensions();
  const [academicRecords, setAcademicRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible && student) {
      loadAcademicData();
    }
  }, [visible, student]);

  const loadAcademicData = async () => {
    setLoading(true);
    try {
      const records = await getAcademicRecordsByStudent(student.prn);
      setAcademicRecords(records);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBody, { width: '90%', maxWidth: 700, maxHeight: '80%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Academic Report Preview</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView>
            <View style={[styles.detailSection, { backgroundColor: '#fff', elevation: 0, borderWidth: 1, borderColor: '#eee' }]}>
              <View style={styles.detailGrid}>
                <DetailItem label="Name" value={student.fullName} />
                <DetailItem label="PRN" value={student.prn} />
                <DetailItem label="Dept" value={student.branch} />
                <DetailItem label="Div" value={student.division} />
                <DetailItem label="SGPA" value={academicRecords.length > 0 ? academicRecords[academicRecords.length - 1].sgpa : 'N/A'} />
                <DetailItem label="CGPA" value={academicRecords.length > 0 ? academicRecords[academicRecords.length - 1].cgpa : 'N/A'} />
              </View>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Semester Report</Text>
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.secondary} style={{ padding: 20 }} />
            ) : academicRecords.length > 0 ? (
              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableCell, { flex: 0.5 }]}>Sem</Text>
                  <Text style={[styles.tableCell, { flex: 2 }]}>Course</Text>
                  <Text style={[styles.tableCell, { flex: 0.6 }]}>MSE</Text>
                  <Text style={[styles.tableCell, { flex: 0.6 }]}>ESE</Text>
                  <Text style={[styles.tableCell, { flex: 0.6 }]}>Grade</Text>
                </View>
                {academicRecords.map((r, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { flex: 0.5 }]}>{r.semester}</Text>
                    <Text style={[styles.tableCell, { flex: 2 }]}>{r.courseName}</Text>
                    <Text style={[styles.tableCell, { flex: 0.6 }]}>{r.mseMarks || 0}</Text>
                    <Text style={[styles.tableCell, { flex: 0.6 }]}>{r.eseMarks || 0}</Text>
                    <Text style={[styles.tableCell, { flex: 0.6, fontWeight: 'bold', color: r.grade === 'F' ? COLORS.error : COLORS.success }]}>{r.grade}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: COLORS.textLight }}>No academic records found for this student.</Text>
              </View>
            )}
          </ScrollView>

          <View style={{ marginTop: 20, alignItems: 'center' }}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.primary, width: '100%' }]} onPress={onClose}>
              <Text style={styles.btnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const StudentDetailsModal = ({ student, visible, onClose, exportStudentPDF }: { student: Student, visible: boolean, onClose: () => void, exportStudentPDF: (student: Student, options: any) => Promise<void> }) => {
  const { width } = useWindowDimensions();
  const [viewMode, setViewMode] = useState<'details' | 'template'>('template');
  const [htmlContent, setHtmlContent] = useState('');
  const [templateLoading, setTemplateLoading] = useState(false);

  useEffect(() => {
    if (visible && student) {
      prepareHtml();
    }
  }, [visible, student]);

  const prepareHtml = async () => {
    setTemplateLoading(true);
    try {
      const academicRecords = await getAcademicRecordsByStudent(student.prn);
      const fees = await getFeePayments(student.prn);
      const activities = await getStudentActivities(student.prn);
      const achievements = await getAchievements(student.prn);
      const internships = await getInternships(student.prn);

      let totalPaid = 0;
      let lastBalance = 0;
      fees.forEach(f => {
        totalPaid += (f.amountPaid || 0);
        lastBalance = f.remainingBalance || 0;
      });

      let academicTable = '<table><thead><tr><th>Sem</th><th>Course</th><th>MSE</th><th>ESE</th><th>Grade</th></tr></thead><tbody>';
      if (academicRecords.length > 0) {
        academicRecords.forEach(r => {
          academicTable += `<tr><td>${r.semester}</td><td>${r.courseName}</td><td>${r.mseMarks || 0}</td><td>${r.eseMarks || 0}</td><td>${r.grade}</td></tr>`;
        });
      } else {
        academicTable += '<tr><td colspan="5">No academic records</td></tr>';
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
        ...activities.map(a => ({
          date: a.activityDate,
          type: a.type === 'Co-curricular' ? 'Technical' : (a.type === 'Extra-curricular' ? 'Non-Technical' : a.type),
          name: a.activityName,
          status: a.verificationStatus
        })),
        ...achievements.map(ach => ({
          date: ach.achievementDate,
          type: ach.type || 'Technical',
          name: ach.achievementName,
          status: ach.verificationStatus
        }))
      ];

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

      const b64LogoLeft = await getBase64Image(LOGO_LEFT_IMG);
      const b64LogoRight = await getBase64Image(LOGO_RIGHT_IMG);
      const b64StudentPhoto = await getBase64Image(student.photoUri || 'https://via.placeholder.com/150');

      const dataMap = {
        college_logo_left: b64LogoLeft,
        college_logo_right: b64LogoRight,
        report_title: "Full Student Academic Record",
        gen_date: new Date().toLocaleDateString(),
        filters_used: `${getFullBranchName(student.branch)} | ${getFullYearName(student.yearOfStudy)} | Div: ${student.division}`,
        student_photo: b64StudentPhoto,
        full_name: (student.fullName || '').toUpperCase(),
        prn: student.prn || '',
        branch: getFullBranchName(student.branch) || '',
        year: getFullYearName(student.yearOfStudy) || '',
        division: student.division || '',
        dob: student.dob || '',
        gender: student.gender || '',
        email: student.email || '',
        phone: student.phone || '',
        aadhar: student.aadhar || '',
        category: student.category || '',
        permanent_addr: student.permanentAddress || '',
        temp_addr: student.temporaryAddress || student.permanentAddress || '',
        father_name: student.fatherName || '',
        mother_name: student.motherName || '',
        father_phone: student.fatherPhone || 'N/A',
        annual_income: `₹${student.annualIncome || '0'}`,
        ssc_school: student.sscSchool || 'N/A',
        ssc_total: student.sscMaxMarks ? student.sscMaxMarks.toString() : 'N/A',
        ssc_obtained: student.sscMarks ? student.sscMarks.toString() : 'N/A',
        ssc_perc: student.sscPercentage ? student.sscPercentage.toString() : '0',
        hsc_diploma_label: (student.admissionType === 'DSE' || !!student.diplomaCollege) ? 'Diploma' : 'HSC (12th)',
        hsc_diploma_college: (student.admissionType === 'DSE' || !!student.diplomaCollege) ? (student.diplomaCollege || 'N/A') : (student.hscCollege || 'N/A'),
        hsc_diploma_total: (student.admissionType === 'DSE' || !!student.diplomaCollege) ? (student.diplomaMaxMarks || 'N/A') : (student.hscMaxMarks || 'N/A'),
        hsc_diploma_obtained: (student.admissionType === 'DSE' || !!student.diplomaCollege) ? (student.diplomaMarks || 'N/A') : (student.hscMarks || 'N/A'),
        hsc_diploma_perc: (student.admissionType === 'DSE' || !!student.diplomaCollege) ? (student.diplomaPercentage || '0') : (student.hscPercentage || '0'),
        sgpa: academicRecords.length > 0 ? academicRecords[academicRecords.length - 1].sgpa?.toString() || 'N/A' : 'N/A',
        cgpa: academicRecords.length > 0 ? academicRecords[academicRecords.length - 1].cgpa?.toString() || 'N/A' : 'N/A',
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


  const exportDetailsPDF = () => {
    exportStudentPDF(student, { all: true });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBody, { width: '95%', maxWidth: 900, height: '90%', padding: 0, overflow: 'hidden' }]}>
          <View style={[styles.modalHeader, { padding: 20, marginBottom: 0 }]}>
            <View>
              <Text style={styles.modalTitle}>Student Profile Preview</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 5 }}>
                <TouchableOpacity onPress={() => setViewMode('template')} style={{ borderBottomWidth: 2, borderBottomColor: viewMode === 'template' ? COLORS.secondary : 'transparent' }}>
                  <Text style={{ color: viewMode === 'template' ? COLORS.secondary : COLORS.textLight, fontWeight: 'bold' }}>Template View</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setViewMode('details')} style={{ borderBottomWidth: 2, borderBottomColor: viewMode === 'details' ? COLORS.secondary : 'transparent' }}>
                  <Text style={{ color: viewMode === 'details' ? COLORS.secondary : COLORS.textLight, fontWeight: 'bold' }}>Data View</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
            {viewMode === 'template' ? (
              isWeb ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  {templateLoading ? (
                    <View style={{ marginTop: 50, alignItems: 'center' }}>
                      <ActivityIndicator size="large" color={COLORS.secondary} />
                      <Text style={{ marginTop: 10, color: COLORS.textLight }}>Generating Profile Preview...</Text>
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
                <View style={{ padding: 20 }}>
                  <Text>Template view is optimized for Web. Please use Data View on mobile.</Text>
                </View>
              )
            ) : (
              <View style={{ padding: 20 }}>
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                  <Image
                    source={{ uri: student.photoUri || 'https://via.placeholder.com/150' }}
                    style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: COLORS.secondary }}
                  />
                </View>
                <View style={styles.detailSection}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Personal Information</Text>
                    <TouchableOpacity onPress={() => openQuickEdit(student, 'Personal Information')}>
                      <Ionicons name="pencil" size={18} color={COLORS.secondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.detailGrid}>
                    <DetailItem label="PRN" value={student.prn} />
                    <DetailItem label="Full Name" value={student.fullName} />
                    <DetailItem label="Gender" value={student.gender} />
                    <DetailItem label="Religion" value={student.religion} />
                    <DetailItem label="Category" value={student.category} />
                    <DetailItem label="Caste" value={student.caste} />
                    <DetailItem label="DOB" value={student.dob} />
                    <DetailItem label="Aadhar" value={student.aadhar} />
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Academic Status</Text>
                    <TouchableOpacity onPress={() => openQuickEdit(student, 'Academic Status')}>
                      <Ionicons name="pencil" size={18} color={COLORS.secondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.detailGrid}>
                    <DetailItem label="Department" value={getFullBranchName(student.branch)} />
                    <DetailItem label="Year" value={getFullYearName(student.yearOfStudy)} />
                    <DetailItem label="Division" value={student.division} />
                    <DetailItem label="Verification" value={student.verificationStatus} color={student.verificationStatus === 'Verified' ? COLORS.success : COLORS.warning} />
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Contact & Address</Text>
                    <TouchableOpacity onPress={() => openQuickEdit(student, 'Contact & Address')}>
                      <Ionicons name="pencil" size={18} color={COLORS.secondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.detailGrid}>
                    <DetailItem label="Phone" value={student.phone} />
                    <DetailItem label="Email" value={student.email} />
                    <DetailItem label="Pincode" value={student.pincode} />
                    <DetailItem label="Permanent Address" value={student.permanentAddress} fullWidth />
                    <DetailItem label="Temporary Address" value={student.temporaryAddress} fullWidth />
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Family Details</Text>
                    <TouchableOpacity onPress={() => openQuickEdit(student, 'Family Details')}>
                      <Ionicons name="pencil" size={18} color={COLORS.secondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.detailGrid}>
                    <DetailItem label="Father's Name" value={student.fatherName} />
                    <DetailItem label="Mother's Name" value={student.motherName} />
                    <DetailItem label="Father's Occupation" value={student.fatherOccupation} />
                    <DetailItem label="Annual Income" value={student.annualIncome} />
                    <DetailItem label="Father's Phone" value={student.fatherPhone} />
                    <DetailItem label="Mother's Phone" value={student.motherPhone} />
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Education History</Text>
                    <TouchableOpacity onPress={() => openQuickEdit(student, 'Education History')}>
                      <Ionicons name="pencil" size={18} color={COLORS.secondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.detailGrid}>
                    <DetailItem label="SSC School" value={student.sscSchool} />
                    <DetailItem label="SSC Marks" value={`${student.sscMarks}/${student.sscMaxMarks} (${student.sscPercentage}%)`} />

                    {(student.admissionType === 'DSE' || !!student.diplomaCollege) ? (
                      <>
                        <DetailItem label="Diploma College" value={student.diplomaCollege} />
                        <DetailItem label="Diploma Marks" value={`${student.diplomaMarks}/${student.diplomaMaxMarks} (${student.diplomaPercentage}%)`} />
                        <DetailItem label="Diploma Branch" value={student.diplomaBranch} />
                      </>
                    ) : (
                      <>
                        <DetailItem label="HSC College" value={student.hscCollege} />
                        <DetailItem label="HSC Marks" value={`${student.hscMarks}/${student.hscMaxMarks} (${student.hscPercentage}%)`} />
                      </>
                    )}
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[styles.row, { borderTopWidth: 1, borderTopColor: '#eee', padding: 20, backgroundColor: '#fff', justifyContent: 'center', gap: 20 }]}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: COLORS.secondary, maxWidth: 250 }]}
              onPress={() => setViewMode('template')}
            >
              <Ionicons name="eye-outline" size={20} color="#fff" />
              <Text style={[styles.btnText, { marginLeft: 8 }]}>Preview Report</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: COLORS.primary, maxWidth: 250 }]}
              onPress={exportDetailsPDF}
            >
              <Ionicons name="print-outline" size={20} color="#fff" />
              <Text style={[styles.btnText, { marginLeft: 8 }]}>Download PDF</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const DetailItem = ({ label, value, fullWidth, color }: { label: string, value: any, fullWidth?: boolean, color?: string }) => (
  <View style={{ width: fullWidth ? '100%' : '48%', marginBottom: 12 }}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={[styles.detailValue, color ? { color } : {}]}>{value || 'N/A'}</Text>
  </View>
);

const AnalyticsRowComp = ({ label, verified, total, color }: any) => {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 13, color: COLORS.textLight }}>{label}</Text>
        <Text style={{ fontSize: 13, fontWeight: '600' }}>{verified}/{total} Verified</Text>
      </View>
      <View style={{ height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ height: '100%', backgroundColor: color, width: total > 0 ? `${(verified / total) * 100}%` : '0%' }} />
      </View>
    </View>
  );
};

// ============= ATTENDANCE MANAGEMENT COMPONENTS =============

const BatchConfigManagement = ({ loadData, yearsOfStudy }: { loadData: () => void, yearsOfStudy: string[] }) => {
  const [config, setConfig] = useState<TeacherBatchConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewStudents, setPreviewStudents] = useState<Student[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    if (config?.rbtFrom && config?.rbtTo && config.rbtFrom.length >= 3 && config.rbtTo.length >= 3) {
      loadPreview();
    } else {
      setPreviewStudents([]);
    }
  }, [config?.rbtFrom, config?.rbtTo, config?.division, config?.class, config?.department]);

  const loadPreview = async () => {
    setPreviewLoading(true);
    try {
      const students = await getStudentsByRbtRange(
        config!.department,
        config!.class,
        config!.division,
        config!.rbtFrom,
        config!.rbtTo
      );
      setPreviewStudents(students);
    } catch (e) {
      console.error(e);
    } finally {
      setPreviewLoading(false);
    }
  };

  const fetchConfig = async () => {
    const session = await getSession();
    if (!session) return;
    const data = await getTeacherBatchConfig(session.userId);
    if (data) setConfig(data);
    else {
      setConfig({
        teacherId: session.userId,
        academicYear: '2025-26',
        department: session.department || 'CSE',
        class: 'SE',
        division: 'A',
        batchName: 'B1',
        rbtFrom: '',
        rbtTo: '',
        status: 'Pending'
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!config?.rbtFrom || !config?.rbtTo) {
      Alert.alert('Error', 'Please enter RBT range');
      return;
    }

    if (config.status === 'Approved') {
      const confirm = await new Promise((resolve) => {
        Alert.alert(
          'Update Configuration',
          'Modifying your batch configuration will reset its status to "Pending" and require Admin approval again. Continue?',
          [
            { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
            { text: 'Update', onPress: () => resolve(true) }
          ]
        );
      });
      if (!confirm) return;
    }

    setSaving(true);
    try {
      await saveTeacherBatchConfig(config);
      // Refresh to get the updated status (which should be Pending now)
      fetchConfig();
      Alert.alert('Success', 'Batch configuration submitted! It has been forwarded to the Admin for approval.');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', `Failed to save configuration: ${e.message || JSON.stringify(e)}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} />;

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'Approved': return COLORS.success;
      case 'Rejected': return COLORS.error;
      default: return COLORS.warning;
    }
  };

  return (
    <View style={styles.moduleCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <Text style={styles.moduleTitle}>My Batch Details</Text>
          <Text style={[styles.helperText, { marginTop: 5 }]}>Configure your assigned RBT range for attendance.</Text>
        </View>
        <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: getStatusColor(config?.status) + '20', borderWidth: 1, borderColor: getStatusColor(config?.status) }}>
          <Text style={{ color: getStatusColor(config?.status), fontWeight: 'bold', fontSize: 12 }}>
            {config?.status || 'Pending'}
          </Text>
        </View>
      </View>

      {config?.status === 'Rejected' && config.rejectionReason && (
        <View style={{ backgroundColor: COLORS.error + '15', padding: 12, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: COLORS.error + '50' }}>
          <Text style={{ color: COLORS.error, fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>Rejection Reason:</Text>
          <Text style={{ color: COLORS.error, fontSize: 13 }}>{config.rejectionReason}</Text>
        </View>
      )}

      <View style={{ marginTop: 20 }}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.filterLabel}>Academic Year</Text>
            <View style={[styles.pickerWrapper, { width: '100%' }]}>
              <Picker selectedValue={config?.academicYear} onValueChange={v => setConfig({ ...config!, academicYear: v })}>
                <Picker.Item label="2025-26" value="2025-26" />
                <Picker.Item label="2024-25" value="2024-25" />
              </Picker>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.filterLabel}>Class</Text>
            <View style={[styles.pickerWrapper, { width: '100%' }]}>
              <Picker selectedValue={config?.class} onValueChange={v => setConfig({ ...config!, class: v })}>
                {yearsOfStudy.map(year => (
                  <Picker.Item key={year} label={getFullYearName(year)} value={year} />
                ))}
              </Picker>
            </View>
          </View>
        </View>

        <View style={[styles.row, { marginTop: 15 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.filterLabel}>Division</Text>
            <View style={[styles.pickerWrapper, { width: '100%' }]}>
              <Picker selectedValue={config?.division} onValueChange={v => setConfig({ ...config!, division: v })}>
                <Picker.Item label="A" value="A" />
                <Picker.Item label="A1" value="A1" />
                <Picker.Item label="A2" value="A2" />
                <Picker.Item label="A3" value="A3" />
                <Picker.Item label="B" value="B" />
                <Picker.Item label="B1" value="B1" />
                <Picker.Item label="B2" value="B2" />
                <Picker.Item label="B3" value="B3" />
                <Picker.Item label="C" value="C" />
                <Picker.Item label="C1" value="C1" />
                <Picker.Item label="C2" value="C2" />
                <Picker.Item label="C3" value="C3" />
              </Picker>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.filterLabel}>Batch Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. B1, B2"
              value={config?.batchName}
              onChangeText={t => setConfig({ ...config!, batchName: t })}
            />
          </View>
        </View>

        <View style={[styles.row, { marginTop: 5 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.filterLabel}>RBT Range From</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. RBT24CS001"
              value={config?.rbtFrom}
              onChangeText={t => setConfig({ ...config!, rbtFrom: t.toUpperCase() })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.filterLabel}>RBT Range To</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. RBT24CS075"
              value={config?.rbtTo}
              onChangeText={t => setConfig({ ...config!, rbtTo: t.toUpperCase() })}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { padding: 15, borderRadius: 10, marginTop: 10, opacity: saving ? 0.7 : 1 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Configuration</Text>}
        </TouchableOpacity>
      </View>

      {/* Batch Preview */}
      <View style={{ marginTop: 30, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 20 }}>
        <Text style={[styles.moduleTitle, { fontSize: 16 }]}>Batch Preview ({previewStudents.length} Students)</Text>
        {previewLoading ? (
          <ActivityIndicator size="small" color={COLORS.secondary} style={{ marginTop: 20 }} />
        ) : previewStudents.length > 0 ? (
          <View style={[styles.table, { marginTop: 10 }]}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, { flex: 1 }]}>PRN</Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>Name</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>Roll</Text>
            </View>
            {previewStudents.slice(0, 10).map(s => (
              <View key={s.prn} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 1 }]}>{s.prn}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{s.fullName}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{s.prn.slice(-3)}</Text>
              </View>
            ))}
            {previewStudents.length > 10 && (
              <Text style={{ textAlign: 'center', padding: 10, color: COLORS.textLight, fontSize: 12 }}>
                + {previewStudents.length - 10} more students
              </Text>
            )}
          </View>
        ) : (
          <View style={{ padding: 30, alignItems: 'center' }}>
            <Ionicons name="people-outline" size={32} color={COLORS.textLight} />
            <Text style={{ color: COLORS.textLight, marginTop: 10 }}>No students found in this range.</Text>
            <Text style={{ color: COLORS.textLight, fontSize: 12, textAlign: 'center' }}>
              Check if Year, Department and Division match your student data.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const AttendanceManagement = ({ filters, loadData }: { filters: any, loadData: () => void }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [absentPrns, setAbsentPrns] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [session, setSession] = useState<AttendanceSession | null>(null);

  useEffect(() => {
    if (filters.dept !== 'All' && filters.year !== 'All' && filters.div !== 'All') {
      initAttendance();
    }
  }, [filters]);

  const initAttendance = async () => {
    setLoading(true);
    const s = await getSession();
    if (!s) return;

    try {
      // Check if attendance already taken today for this division
      const today = new Date().toISOString().split('T')[0];
      const { data: existingSession, error } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('date', today)
        .eq('department', filters.dept)
        .eq('academic_year', filters.year)
        .eq('division', filters.div)
        .maybeSingle();

      if (existingSession) {
        setSession(toCamelCase(existingSession));
        const records = await getAttendanceRecords(existingSession.id);
        const absents = new Set(records.filter(r => r.status === 'Absent').map(r => r.studentPrn));
        setAbsentPrns(absents);
      } else {
        setSession(null);
        setAbsentPrns(new Set());
      }

      const studentList = await getStudentsByDivision(filters.dept, filters.year, filters.div, true);
      setStudents(studentList);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleAbsent = (prn: string) => {
    if (session?.locked) return;
    setAbsentPrns(prev => {
      const next = new Set(prev);
      if (next.has(prn)) next.delete(prn);
      else next.add(prn);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (students.length === 0) return;

    const confirmMsg = `Are you sure? Marking ${absentPrns.size} students as absent out of ${students.length}.`;
    if (!isWeb) {
      Alert.alert('Confirm Submission', confirmMsg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: submitFinal }
      ]);
    } else {
      if (window.confirm(confirmMsg)) submitFinal();
    }
  };

  const submitFinal = async () => {
    setSubmitting(true);
    try {
      const s = await getSession();
      const newSession = await createAttendanceSession({
        teacherId: s!.userId,
        date: new Date().toISOString().split('T')[0],
        academicYear: filters.year,
        department: filters.dept,
        class: filters.year, // Using year as class for now as per schema
        division: filters.div,
        locked: true
      });

      const records: AttendanceRecord[] = students.map(st => ({
        sessionId: newSession.id,
        studentPrn: st.prn,
        status: absentPrns.has(st.prn) ? 'Absent' : 'Present',
        remark: ''
      }));

      await saveAttendanceRecords(records);
      setSession(newSession);
      Alert.alert('Success', 'Attendance recorded successfully');
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to record attendance');
    } finally {
      setSubmitting(false);
    }
  };

  if (filters.dept === 'All' || filters.year === 'All' || filters.div === 'All') {
    return (
      <View style={[styles.moduleCard, { alignItems: 'center', padding: 40 }]}>
        <Ionicons name="filter-outline" size={48} color={COLORS.primary} />
        <Text style={{ marginTop: 10, fontSize: 16, fontWeight: 'bold' }}>Select Filters</Text>
        <Text style={{ textAlign: 'center', color: COLORS.textLight, marginTop: 5 }}>
          Please select Department, Year, and Division to take attendance.
        </Text>
      </View>
    );
  }

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} />;

  return (
    <View style={styles.moduleCard}>
      <View style={styles.moduleHeader}>
        <View>
          <Text style={styles.moduleTitle}>Attendance Taker</Text>
          <Text style={styles.helperText}>
            {filters.year} {filters.div} | {students.length} Students
          </Text>
        </View>
        {session?.locked ? (
          <View style={{ backgroundColor: COLORS.success + '20', padding: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="lock-closed" size={16} color={COLORS.success} />
            <Text style={{ color: COLORS.success, fontWeight: 'bold', marginLeft: 5 }}>Submitted</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.saveBtn, { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }]}
            onPress={handleSubmit}
            disabled={submitting || students.length === 0}
          >
            {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Submit Absentees</Text>}
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.helperText, { marginBottom: 15, color: COLORS.secondary }]}>
        * Tap on students who are ABSENT. All others are marked Present by default.
      </Text>

      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.tableCell, { flex: 0.8 }]}>Roll / PRN</Text>
          <Text style={[styles.tableCell, { flex: 2 }]}>Student Name</Text>
          <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>Status</Text>
        </View>
        <FlatList
          data={students}
          keyExtractor={item => item.prn}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const isAbsent = absentPrns.has(item.prn);
            return (
              <TouchableOpacity
                style={[styles.tableRow, isAbsent && { backgroundColor: COLORS.error + '05' }]}
                onPress={() => toggleAbsent(item.prn)}
                disabled={session?.locked}
              >
                <Text style={[styles.tableCell, { flex: 0.8 }]}>{item.prn.slice(-3)}</Text>
                <Text style={[styles.tableCell, { flex: 2, fontWeight: isAbsent ? 'bold' : 'normal' }]}>{item.fullName}</Text>
                <View style={[
                  { flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
                  !isAbsent ? { backgroundColor: COLORS.success + '15' } : { backgroundColor: COLORS.error + '15' }
                ]}>
                  <Text style={{
                    fontWeight: 'bold', fontSize: 12,
                    color: !isAbsent ? COLORS.success : COLORS.error
                  }}>
                    {isAbsent ? 'ABSENT' : 'PRESENT'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </View>
  );
};

const AttendanceSummaryManagement = ({ filters }: any) => {
  const [config, setConfig] = useState<TeacherBatchConfig | null>(null);
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Follow-up Modal State
  const [callModalVisible, setCallModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [callForm, setCallForm] = useState({
    reason: 'Family Emergency',
    customDescription: '',
    reportUrl: '',
    markAsLate: false
  });

  useEffect(() => {
    loadGfmDashboard();
  }, [filters]);

  const loadGfmDashboard = async () => {
    setLoading(true);
    const s = await getSession();
    if (!s) return;

    const batchConfig = await getTeacherBatchConfig(s.id);
    if (!batchConfig) {
      setLoading(false);
      return;
    }
    setConfig(batchConfig);

    const today = new Date().toISOString().split('T')[0];
    // Normalize division: 'A2' -> 'A'
    const mainDivision = batchConfig.division ? batchConfig.division[0].toUpperCase() : '';

    // Match session's academic_year with batchConfig's class (e.g. 'SE') if academicYear is a session year (2024-25)
    const academicMatch = batchConfig.class || batchConfig.academicYear;

    const { data: divSession } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('date', today)
      .eq('department', batchConfig.department || s.department)
      .eq('academic_year', academicMatch)
      .eq('division', mainDivision)
      .maybeSingle();

    if (divSession) {
      setSession(toCamelCase(divSession));
      const attRecords = await getAttendanceRecords(divSession.id);
      const filtered = attRecords.filter(r => {
        const fromVal = batchConfig.rbtFrom.toUpperCase();
        const toVal = batchConfig.rbtTo.toUpperCase();
        const prnVal = r.studentPrn.toUpperCase();

        if (!isNaN(Number(fromVal)) && !isNaN(Number(toVal))) {
          const rollNo = parseInt(r.studentPrn.slice(-3));
          return rollNo >= parseInt(fromVal) && rollNo <= parseInt(toVal);
        }
        return prnVal >= fromVal && prnVal <= toVal;
      });
      setRecords(filtered);
    } else {
      setSession(null);
      setRecords([]);
    }
    setLoading(false);
  };

  const openCallFollowup = (record: any) => {
    setSelectedStudent(record);
    setCallForm({
      reason: 'Family Emergency',
      customDescription: '',
      reportUrl: '',
      markAsLate: false
    });
    setCallModalVisible(true);
  };

  const submitFollowup = async () => {
    if (!selectedStudent) return;
    setSaving(true);
    try {
      const s = await getSession();
      // 1. Log Communication
      await logCommunication(
        s?.id,
        selectedStudent.studentPrn,
        'call',
        `Follow-up: ${callForm.reason}. ${callForm.customDescription}`,
        'Parent',
        undefined,
        undefined,
        callForm.reason,
        callForm.customDescription,
        callForm.reportUrl
      );

      // 2. If marked as late, update attendance record
      if (callForm.markAsLate) {
        await supabase
          .from('attendance_records')
          .update({
            status: 'Present',
            remark: `Late Remark: ${callForm.reason}`,
            approved_by_gfm: s?.id
          })
          .eq('id', selectedStudent.id);
      } else {
        // Just verify as GFM
        await supabase
          .from('attendance_records')
          .update({
            approved_by_gfm: s?.id,
            remark: callForm.reason
          })
          .eq('id', selectedStudent.id);
      }

      Alert.alert('Success', 'Follow-up logged successfully');
      setCallModalVisible(false);
      loadGfmDashboard();
    } catch (e) {
      Alert.alert('Error', 'Failed to log follow-up');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} />;

  if (!config) return <View style={styles.moduleCard}><Text>No batch profile found.</Text></View>;

  const ABSENT_REASONS = ['Family Emergency', 'Medical Issue', 'Personal Work', 'Transportation', 'Other'];

  const renderDashboardContent = () => {
    if (!session) {
      return (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Ionicons name="today-outline" size={48} color={COLORS.textLight} />
          <Text style={{ marginTop: 15, fontSize: 14, color: COLORS.text, textAlign: 'center' }}>
            Today's attendance not yet submitted for Division {config.division[0]}.
          </Text>
          <Text style={{ marginTop: 5, fontSize: 12, color: COLORS.textLight, textAlign: 'center' }}>
            Check back once the attendance taker submits today's records.
          </Text>
        </View>
      );
    }

    return (
      <View>
        <View style={styles.attendanceSummaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Batch</Text>
              <Text style={styles.summaryValue}>{records.length}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Present</Text>
              <Text style={[styles.summaryValue, { color: COLORS.success }]}>
                {records.filter(r => r.status === 'Present').length}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Absent</Text>
              <Text style={[styles.summaryValue, { color: COLORS.error }]}>
                {records.filter(r => r.status === 'Absent').length}
              </Text>
            </View>
          </View>

          {records.filter(r => r.status === 'Absent').length > 0 && (
            <View style={styles.absentRollsRow}>
              <Text style={styles.absentRollsLabel}>Absent Roll Nos:</Text>
              <Text style={styles.absentRollsText}>
                {records.filter(r => r.status === 'Absent').map(r => r.studentPrn.slice(-3)).join(', ')}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, { flex: 0.6 }]}>Roll</Text>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>Name</Text>
            <Text style={[styles.tableCell, { flex: 1.2, textAlign: 'center' }]}>Status</Text>
            <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'center' }]}>Follow-up</Text>
          </View>
          {records.map((r) => (
            <View key={r.id} style={[styles.tableRow, r.status === 'Absent' && { backgroundColor: COLORS.error + '05' }]}>
              <Text style={[styles.tableCell, { flex: 0.6 }]}>{r.studentPrn.slice(-3)}</Text>
              <Text style={[styles.tableCell, { flex: 1.5, fontSize: 13 }]}>{r.fullName || r.studentPrn}</Text>
              <View style={{ flex: 1.2, alignItems: 'center' }}>
                <View style={{
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  borderRadius: 6,
                  backgroundColor: r.status === 'Present' ? COLORS.success + '15' : COLORS.error + '15'
                }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: r.status === 'Present' ? COLORS.success : COLORS.error }}>
                    {r.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={{ flex: 0.8, alignItems: 'center' }}>
                {r.status === 'Absent' ? (
                  <TouchableOpacity onPress={() => openCallFollowup(r)}>
                    <Ionicons name="call" size={22} color={COLORS.primary} />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="checkmark-done-circle" size={22} color={COLORS.success} />
                )}
              </View>
            </View>
          ))}
          {records.length === 0 && <Text style={{ textAlign: 'center', padding: 20 }}>No students in your RBT group.</Text>}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.moduleCard}>
      <View style={styles.moduleHeader}>
        <View>
          <Text style={styles.moduleTitle}>GFM Verification Dashboard</Text>
          <Text style={styles.helperText}>Review and contact absent students in your group.</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadGfmDashboard}>
          <Ionicons name="refresh" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {renderDashboardContent()}

      <Modal visible={callModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>Recording Follow-up</Text>
            <Text style={{ textAlign: 'center', marginBottom: 20, color: COLORS.textLight }}>
              Contacting: {selectedStudent?.fullName}
            </Text>

            <ScrollView>
              <Text style={styles.label}>Reason of Absence</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={callForm.reason}
                  onValueChange={v => setCallForm({ ...callForm, reason: v })}
                >
                  {ABSENT_REASONS.map(r => <Picker.Item key={r} label={r} value={r} />)}
                </Picker>
              </View>

              <Text style={styles.label}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Details of conversation..."
                multiline
                value={callForm.customDescription}
                onChangeText={v => setCallForm({ ...callForm, customDescription: v })}
              />

              <Text style={styles.label}>Report Upload URL (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Google Drive / Image Link"
                value={callForm.reportUrl}
                onChangeText={v => setCallForm({ ...callForm, reportUrl: v })}
              />

              <TouchableOpacity
                style={[styles.row, { alignItems: 'center', marginVertical: 10 }]}
                onPress={() => setCallForm({ ...callForm, markAsLate: !callForm.markAsLate })}
              >
                <View style={{
                  width: 20, height: 20,
                  borderWidth: 2, borderColor: COLORS.primary,
                  borderRadius: 4, marginRight: 10,
                  backgroundColor: callForm.markAsLate ? COLORS.primary : 'transparent'
                }}>
                  {callForm.markAsLate && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text style={{ fontSize: 13, color: COLORS.text }}>Student is Present with Late Remark</Text>
              </TouchableOpacity>

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.cancelBtn]}
                  onPress={() => setCallModalVisible(false)}
                >
                  <Text style={{ color: COLORS.error, fontWeight: 'bold' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.saveBtn]}
                  onPress={submitFollowup}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Submit Log</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};


const StudentManagement = ({ students, filters, onViewDetails, onPrint, handleVerify, onCall }: any) => {
  const exportCSV = () => {

    let csv = 'PRN,Name,Department,Year,Division,Status\n';
    students.forEach(s => {
      csv += `${s.prn},"${s.fullName}","${s.branch}","${s.yearOfStudy}","${s.division}","${s.verificationStatus}"\n`;
    });

    if (isWeb) {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Student_Report_${filters.dept}.csv`;
      a.click();
    } else {
      Alert.alert('Export', 'CSV Exported (Simulation)');
    }
  };

  return (
    <View style={styles.moduleCard}>
      <View style={styles.moduleHeader}>
        <Text style={styles.moduleTitle}>Student Management</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.success }]} onPress={exportCSV}>
            <Ionicons name="download-outline" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>Export CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.tableCell, { flex: 0.5 }]}>PRN</Text>
          <Text style={[styles.tableCell, { flex: 1.5 }]}>Name</Text>
          <Text style={[styles.tableCell, { flex: 1 }]}>Department</Text>
          <Text style={[styles.tableCell, { flex: 0.6 }]}>Year</Text>
          <Text style={[styles.tableCell, { flex: 0.5 }]}>Division</Text>
          <Text style={[styles.tableCell, { flex: 0.8 }]}>Actions</Text>
        </View>
        {students.map(s => (
          <View key={s.prn} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 0.5 }]}>{s.prn}</Text>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>{s.fullName}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{getFullBranchName(s.branch)}</Text>
            <Text style={[styles.tableCell, { flex: 0.6 }]}>{getFullYearName(s.yearOfStudy)}</Text>
            <Text style={[styles.tableCell, { flex: 0.5 }]}>{s.division}</Text>
            <View style={{ flex: 0.8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={() => onCall && onCall(s, 'student')}>
                <Ionicons name="call-outline" size={20} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onViewDetails(s)}>
                <Ionicons name="eye-outline" size={20} color={COLORS.secondary} />
              </TouchableOpacity>
              {s.verificationStatus !== 'Verified' ? (

                <TouchableOpacity onPress={() => handleVerify('students', s.prn, 'Verified')}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.success} />
                </TouchableOpacity>
              ) : (
                <Ionicons name="checkmark-done-circle" size={20} color={COLORS.success} />
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const CoursesManagement = ({ courses, filters, loadData }: { courses: CourseDef[], filters: any, loadData: () => void }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [newCourse, setNewCourse] = useState<CourseDef>({
    courseCode: '', courseName: '', department: filters.dept === 'All' ? 'CSE' : filters.dept,
    semester: filters.sem === 'All' ? 3 : (filters.sem || 3), credits: 3, iseMax: 20, mseMax: 30, eseMax: 50
  });

  useEffect(() => {
    if (filters) {
      setNewCourse(prev => ({
        ...prev,
        department: filters.dept === 'All' ? prev.department : filters.dept,
        semester: filters.sem === 'All' ? prev.semester : (filters.sem || prev.semester)
      }));
    }
  }, [filters]);

  const handleSave = async () => {
    if (!newCourse.courseCode || !newCourse.courseName) {
      Alert.alert('Error', 'Please enter course code and name');
      return;
    }
    try {
      await saveCourseDef(newCourse);
      await loadData();
      setModalOpen(false);
      Alert.alert('Success', 'Course saved successfully');
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes('UNIQUE')) {
        Alert.alert('Error', 'Course Code already exists. Please use a unique code.');
      } else {
        Alert.alert('Error', 'Failed to save course. ' + (e.message || ''));
      }
    }
  };

  return (
    <View style={styles.moduleCard}>
      <View style={styles.moduleHeader}>
        <Text style={styles.moduleTitle}>Courses Management</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.success }]} onPress={() => setModalOpen(true)}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>Add Course</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.tableCell, { flex: 0.7 }]}>Code</Text>
          <Text style={[styles.tableCell, { flex: 1.8 }]}>Name</Text>
          <Text style={[styles.tableCell, { flex: 0.4 }]}>Sem</Text>
          <Text style={[styles.tableCell, { flex: 0.4 }]}>Cr</Text>
          <Text style={[styles.tableCell, { flex: 0.4 }]}>ISE</Text>
          <Text style={[styles.tableCell, { flex: 0.4 }]}>MSE</Text>
          <Text style={[styles.tableCell, { flex: 0.4 }]}>ESE</Text>
        </View>
        {courses.map(c => (
          <View key={c.courseCode} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 0.7 }]}>{c.courseCode}</Text>
            <Text style={[styles.tableCell, { flex: 1.8 }]}>{c.courseName}</Text>
            <Text style={[styles.tableCell, { flex: 0.4 }]}>{c.semester}</Text>
            <Text style={[styles.tableCell, { flex: 0.4 }]}>{c.credits}</Text>
            <Text style={[styles.tableCell, { flex: 0.4 }]}>{c.iseMax}</Text>
            <Text style={[styles.tableCell, { flex: 0.4 }]}>{c.mseMax}</Text>
            <Text style={[styles.tableCell, { flex: 0.4 }]}>{c.eseMax}</Text>
          </View>
        ))}
      </View>

      <Modal visible={modalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBody, { maxWidth: 500 }]}>
            <Text style={styles.modalTitle}>Add New Course</Text>
            <ScrollView>
              <Text style={styles.filterLabel}>Department / Branch</Text>
              <View style={[styles.pickerWrapper, { width: '100%', marginBottom: 15 }]}>
                <Picker
                  selectedValue={newCourse.department}
                  onValueChange={v => setNewCourse({ ...newCourse, department: v })}
                >
                  {Object.keys(BRANCH_MAPPINGS).map(d => (
                    <Picker.Item key={d} label={BRANCH_MAPPINGS[d]} value={d} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.filterLabel}>Course Code</Text>
              <TextInput placeholder="Course Code" style={styles.input} value={newCourse.courseCode} onChangeText={t => setNewCourse({ ...newCourse, courseCode: t })} />

              <Text style={styles.filterLabel}>Course Name</Text>
              <TextInput placeholder="Course Name" style={styles.input} value={newCourse.courseName} onChangeText={t => setNewCourse({ ...newCourse, courseName: t })} />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.filterLabel}>Credits</Text>
                  <TextInput placeholder="Credits" style={styles.input} keyboardType="numeric" value={newCourse.credits.toString()} onChangeText={t => setNewCourse({ ...newCourse, credits: parseInt(t) || 0 })} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.filterLabel}>Semester</Text>
                  <TextInput placeholder="Semester" style={styles.input} keyboardType="numeric" value={newCourse.semester.toString()} onChangeText={t => setNewCourse({ ...newCourse, semester: parseInt(t) || 0 })} />
                </View>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.filterLabel}>ISE Max</Text>
                  <TextInput placeholder="ISE Max" style={styles.input} keyboardType="numeric" value={newCourse.iseMax.toString()} onChangeText={t => setNewCourse({ ...newCourse, iseMax: parseInt(t) || 0 })} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.filterLabel}>MSE Max</Text>
                  <TextInput placeholder="MSE Max" style={styles.input} keyboardType="numeric" value={newCourse.mseMax.toString()} onChangeText={t => setNewCourse({ ...newCourse, mseMax: parseInt(t) || 0 })} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.filterLabel}>ESE Max</Text>
                  <TextInput placeholder="ESE Max" style={styles.input} keyboardType="numeric" value={newCourse.eseMax.toString()} onChangeText={t => setNewCourse({ ...newCourse, eseMax: parseInt(t) || 0 })} />
                </View>
              </View>
            </ScrollView>

            <View style={styles.row}>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => setModalOpen(false)}>
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleSave}>
                <Text style={styles.btnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const AcademicManagement = ({ students, filters, onViewDetails, onViewAcademicDetails }: any) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedSemForMarks, setSelectedSemForMarks] = useState<number>(filters.sem === 'All' ? 3 : filters.sem);
  const [courses, setCourses] = useState<CourseDef[]>([]);
  const [marks, setMarks] = useState<Record<number, any>>({});
  const [sgpa, setSgpa] = useState('');
  const [cgpa, setCgpa] = useState('');
  const [academicStats, setAcademicStats] = useState<Record<string, any>>({});

  useEffect(() => {
    if (filters) {
      loadCoursesAndMarks();
      loadAllAcademicStats();
    }
  }, [filters, students, selectedStudent, selectedSemForMarks]);

  const loadAllAcademicStats = async () => {
    const statsMap: Record<string, any> = {};
    for (const s of students) {
      const records = await getAcademicRecordsByStudent(s.prn);
      if (records && records.length > 0) {
        const semToUse = filters.sem === 'All' ? records[records.length - 1].semester : filters.sem;
        const semRecord = records.find(r => r.semester === semToUse) || records[records.length - 1];
        statsMap[s.prn] = { sgpa: semRecord.sgpa, cgpa: semRecord.cgpa };
      }
    }
    setAcademicStats(statsMap);
  };

  const loadCoursesAndMarks = async () => {
    if (!filters) return;
    const c = await getAllCoursesDef();
    const deptToUse = selectedStudent ? selectedStudent.branch : filters.dept;
    const semToUse = selectedStudent ? selectedSemForMarks : filters.sem;

    const filteredCourses = c.filter(course =>
      (deptToUse === 'All' || course.department === deptToUse) &&
      (semToUse === 'All' || course.semester === semToUse)
    );
    setCourses(filteredCourses);

    if (selectedStudent) {
      const existing = await getAcademicRecordsByStudent(selectedStudent.prn);
      const marksMap: Record<number, any> = {};
      existing.forEach(r => {
        if (semToUse === 'All' || r.semester === semToUse) {
          marksMap[r.courseDefId] = r;
        }
      });
      setMarks(marksMap);
      const semRecord = semToUse === 'All' ? existing[existing.length - 1] : existing.find(r => r.semester === semToUse);
      if (semRecord) {
        setSgpa(semRecord.sgpa?.toString() || '');
        setCgpa(semRecord.cgpa?.toString() || '');
      } else {
        setSgpa('');
        setCgpa('');
      }
    }
  };

  const calculateSGPA = () => {
    const gradePoints: Record<string, number> = {
      'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 'C': 5, 'P': 4, 'F': 0
    };

    let totalCredits = 0;
    let weightedPoints = 0;

    courses.forEach(c => {
      const m = marks[c.id!];
      if (m && m.grade) {
        const points = gradePoints[m.grade] || 0;
        weightedPoints += points * (c.credits || 3);
        totalCredits += (c.credits || 3);
      }
    });

    if (totalCredits > 0) {
      const calculatedSgpa = (weightedPoints / totalCredits).toFixed(2);
      setSgpa(calculatedSgpa);
      if (!cgpa) setCgpa(calculatedSgpa);
    }
  };

  const handleEdit = (s: Student) => {
    setSelectedStudent(s);
    setModalOpen(true);
  };

  const handleSaveMarks = async () => {
    if (!selectedStudent) return;

    try {
      for (const c of courses) {
        const m = marks[c.id!];
        if (!m) continue;

        await saveAcademicRecord({
          prn: selectedStudent.prn,
          courseDefId: c.id!,
          semester: c.semester,
          iseMarks: Number(m.iseMarks) || 0,
          mseMarks: Number(m.mseMarks) || 0,
          eseMarks: Number(m.eseMarks) || 0,
          totalMarks: (Number(m.iseMarks) || 0) + (Number(m.mseMarks) || 0) + (Number(m.eseMarks) || 0),
          grade: m.grade || 'F',
          sgpa: Number(sgpa) || 0,
          cgpa: Number(cgpa) || 0,
          academicYear: filters.year,
        });
      }
      setModalOpen(false);
      Alert.alert('Success', 'Academic records updated');
      loadAllAcademicStats();
    } catch (e) {
      Alert.alert('Error', 'Failed to save marks');
    }
  };

  const updateMark = (courseId: number, field: string, value: string) => {
    const course = courses.find(c => c.id === courseId);
    let finalValue = value;

    if (field !== 'grade' && course) {
      const numVal = parseInt(value) || 0;
      let maxVal = 50;
      if (field === 'iseMarks') maxVal = course.iseMax || 20;
      else if (field === 'mseMarks') maxVal = course.mseMax || 30;
      else if (field === 'eseMarks') maxVal = course.eseMax || 50;

      if (numVal > maxVal) {
        Alert.alert('Invalid Marks', `Maximum marks for ${field.replace('Marks', '').toUpperCase()} is ${maxVal}`);
        finalValue = maxVal.toString();
      } else if (numVal < 0) {
        finalValue = '0';
      }
    }

    setMarks(prev => ({
      ...prev,
      [courseId]: {
        ...(prev[courseId] || { iseMarks: 0, mseMarks: 0, eseMarks: 0, grade: 'F' }),
        [field]: field === 'grade' ? value : finalValue
      }
    }));
  };

  const exportCSV = () => {
    let csv = 'PRN,Name,SGPA,CGPA\n';
    students.forEach((s: Student) => {
      csv += `${s.prn},${s.fullName},${academicStats[s.prn]?.sgpa || '-'},${academicStats[s.prn]?.cgpa || '-'}\n`;
    });

    if (isWeb) {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      a.setAttribute('download', `academic_records_${filters.dept}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      Alert.alert('Export', 'CSV Exported locally (Simulation)');
    }
  };

  const exportAcademicPDF = () => {
    if (!isWeb) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Academic Performance Report", 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Dept: ${filters.dept} | Year: ${filters.year} | Sem: ${filters.sem}`, 105, 22, { align: 'center' });

    const tableData = students.map((s: Student) => [
      s.prn,
      s.fullName,
      academicStats[s.prn]?.sgpa || '-',
      academicStats[s.prn]?.cgpa || '-'
    ]);

    (doc as any).autoTable({
      startY: 30,
      head: [['PRN', 'Student Name', 'SGPA', 'CGPA']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary }
    });
    doc.save(`Academic_Report_${filters.dept}_Sem${filters.sem}.pdf`);
  };

  return (
    <View style={styles.moduleCard}>
      <View style={styles.moduleHeader}>
        <Text style={styles.moduleTitle}>Academic Management</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.success }]} onPress={exportCSV}>
            <Ionicons name="download-outline" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>Export CSV</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.helperText}>Showing records for {filters.dept} - Year {filters.year} - Div {filters.div}</Text>

      <ScrollView horizontal>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, { width: 100 }]}>PRN</Text>
            <Text style={[styles.tableCell, { width: 200 }]}>Name</Text>
            <Text style={[styles.tableCell, { width: 80 }]}>SGPA</Text>
            <Text style={[styles.tableCell, { width: 80 }]}>CGPA</Text>
            <Text style={[styles.tableCell, { width: 120, textAlign: 'center' }]}>Actions</Text>
          </View>
          {students.map((s: Student) => (
            <View key={s.prn} style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: 100 }]}>{s.prn}</Text>
              <Text style={[styles.tableCell, { width: 200 }]}>{s.fullName}</Text>
              <Text style={[styles.tableCell, { width: 80 }]}>{academicStats[s.prn]?.sgpa || '-'}</Text>
              <Text style={[styles.tableCell, { width: 80 }]}>{academicStats[s.prn]?.cgpa || '-'}</Text>
              <View style={{ width: 100, flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
                <TouchableOpacity onPress={() => onViewAcademicDetails(s)}>
                  <Ionicons name="eye-outline" size={20} color={COLORS.secondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleEdit(s)}>
                  <Ionicons name="create-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBody, { width: '95%', maxWidth: 800 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Enter Marks: {selectedStudent?.fullName}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                  <Text style={[styles.filterLabel, { marginBottom: 0, marginRight: 10 }]}>Select Semester:</Text>
                  <View style={[styles.pickerWrapper, { width: 120, height: 35 }]}>
                    <Picker
                      selectedValue={selectedSemForMarks}
                      onValueChange={(val) => setSelectedSemForMarks(Number(val))}
                      style={{ height: 35 }}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                        <Picker.Item key={s} label={`Sem ${s}`} value={s} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, { flex: 2 }]}>Course</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>ISE</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>MSE</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>ESE</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>Grade</Text>
              </View>
              {courses.map(c => (
                <View key={c.id} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>{c.courseName}</Text>
                  <TextInput
                    style={[styles.smallInput, { flex: 1 }]}
                    keyboardType="numeric"
                    placeholder={`Max ${c.iseMax}`}
                    placeholderTextColor={COLORS.text}
                    value={marks[c.id!]?.iseMarks ? marks[c.id!]?.iseMarks.toString() : ''}
                    onChangeText={t => updateMark(c.id!, 'iseMarks', t)}
                  />
                  <TextInput
                    style={[styles.smallInput, { flex: 1 }]}
                    keyboardType="numeric"
                    placeholder={`Max ${c.mseMax}`}
                    placeholderTextColor={COLORS.text}
                    value={marks[c.id!]?.mseMarks ? marks[c.id!]?.mseMarks.toString() : ''}
                    onChangeText={t => updateMark(c.id!, 'mseMarks', t)}
                  />
                  <TextInput
                    style={[styles.smallInput, { flex: 1 }]}
                    keyboardType="numeric"
                    placeholder={`Max ${c.eseMax}`}
                    placeholderTextColor={COLORS.text}
                    value={marks[c.id!]?.eseMarks ? marks[c.id!]?.eseMarks.toString() : ''}
                    onChangeText={t => updateMark(c.id!, 'eseMarks', t)}
                  />
                  <View style={[styles.pickerWrapper, { flex: 1, height: 40 }]}>
                    <Picker
                      selectedValue={marks[c.id!]?.grade || 'F'}
                      onValueChange={v => updateMark(c.id!, 'grade', v)}
                      style={{ height: 40, color: marks[c.id!]?.grade === 'F' ? COLORS.error : COLORS.text }}
                    >
                      {['O', 'A+', 'A', 'B+', 'B', 'C', 'P', 'F'].map(g => (
                        <Picker.Item key={g} label={g} value={g} color={g === 'F' ? COLORS.error : undefined} />
                      ))}
                    </Picker>
                  </View>
                </View>
              ))}

              <View style={[styles.row, { marginTop: 20 }]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.filterLabel}>SGPA</Text>
                    <TouchableOpacity onPress={calculateSGPA}>
                      <Text style={{ color: COLORS.secondary, fontSize: 12, fontWeight: 'bold' }}>Auto Calculate</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="Enter SGPA"
                    value={sgpa}
                    onChangeText={setSgpa}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.filterLabel}>CGPA</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="Enter CGPA"
                    value={cgpa}
                    onChangeText={setCgpa}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.row}>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => setModalOpen(false)}>
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleSaveMarks}>
                <Text style={styles.btnText}>Save Marks</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const FeeManagement = ({ students, filters, handleVerify }: any) => {
  const [stats, setStats] = useState<any>(null);
  const [feeData, setFeeData] = useState<any[]>([]);
  const [feeStatusFilter, setFeeStatusFilter] = useState<'All' | 'Paid' | 'Not Paid / Remaining'>('All');

  useEffect(() => {
    if (filters) {
      loadFeeData();
    }
  }, [filters]);

  const loadFeeData = async () => {
    if (!filters) return;
    const s = await getFeeAnalytics(filters.dept, filters.year, filters.div);
    const data = await getFeePaymentsByFilter(filters.dept, filters.year, filters.div);
    setStats(s);
    setFeeData(data);
  };

  const filteredFeeData = feeData.filter(f => {
    if (feeStatusFilter === 'All') return true;
    if (feeStatusFilter === 'Paid') return (f.lastBalance || 0) <= 0;
    if (feeStatusFilter === 'Not Paid / Remaining') return (f.lastBalance || 0) > 0;
    return true;
  });


  const exportFeeCSV = (onlyDefaulters = false) => {
    let csv = 'PRN,Name,Year,Total Fee,Paid,Balance\n';
    const dataToExport = onlyDefaulters
      ? feeData.filter(f => (f.lastBalance || 0) > 0)
      : filteredFeeData;

    dataToExport.forEach(f => {
      csv += `${f.prn},"${f.fullName}","${f.yearOfStudy}",${f.totalFee || 0},${f.paidAmount || 0},${f.lastBalance || 0}\n`;
    });

    if (isWeb) {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${onlyDefaulters ? 'Defaulters' : 'Fee'}_Report_${filters.dept}.csv`;
      a.click();
    } else {
      Alert.alert('Export', 'CSV Exported (Simulation)');
    }
  };

  return (
    <View>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Students</Text>
          <Text style={styles.statValue}>{stats?.totalStudents || 0}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Defaulters</Text>
          <Text style={[styles.statValue, { color: COLORS.error }]}>{stats?.studentsWithRemaining || 0}</Text>
        </View>
        <View style={[styles.statCard, { flex: 1.5 }]}>
          <Text style={styles.statLabel}>Total Outstanding</Text>
          <Text style={styles.statValue}>₹{stats?.totalRemainingAmount || 0}</Text>
        </View>
      </View>

      <View style={styles.moduleCard}>
        <View style={styles.moduleHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
            <Text style={styles.moduleTitle}>Fee Management</Text>
            <View style={[styles.pickerWrapper, { width: 150 }]}>
              <Picker
                selectedValue={feeStatusFilter}
                onValueChange={setFeeStatusFilter}
                style={styles.picker}
              >
                <Picker.Item label="All Fees" value="All" />
                <Picker.Item label="Paid" value="Paid" />
                <Picker.Item label="Not Paid / Remaining" value="Not Paid / Remaining" />
              </Picker>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.success }]} onPress={() => exportFeeCSV(false)}>
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Export All CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.error }]} onPress={() => exportFeeCSV(true)}>
              <Ionicons name="warning-outline" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Defaulters CSV</Text>
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView horizontal>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, { width: 100 }]}>PRN</Text>
              <Text style={[styles.tableCell, { width: 150 }]}>Name</Text>
              <Text style={[styles.tableCell, { width: 80 }]}>Year</Text>
              <Text style={[styles.tableCell, { width: 80 }]}>Total</Text>
              <Text style={[styles.tableCell, { width: 80 }]}>Paid</Text>
              <Text style={[styles.tableCell, { width: 80 }]}>Balance</Text>
              <Text style={[styles.tableCell, { width: 80 }]}>Status</Text>
              <Text style={[styles.tableCell, { width: 120 }]}>Actions</Text>
            </View>
            {filteredFeeData.map((f: any) => (
              <View key={f.prn} style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: 100 }]}>{f.prn}</Text>
                <Text style={[styles.tableCell, { width: 150 }]}>{f.fullName}</Text>
                <Text style={[styles.tableCell, { width: 80 }]}>{f.yearOfStudy}</Text>
                <Text style={[styles.tableCell, { width: 80 }]}>₹{f.totalFee || 0}</Text>
                <Text style={[styles.tableCell, { width: 80, color: COLORS.success }]}>₹{f.paidAmount || 0}</Text>
                <Text style={[styles.tableCell, { width: 80, color: (f.lastBalance || 0) > 0 ? COLORS.error : COLORS.success }]}>₹{f.lastBalance || 0}</Text>
                <Text style={[styles.tableCell, { width: 80, color: (f.lastBalance || 0) > 0 ? COLORS.warning : COLORS.success }]}>
                  {(f.lastBalance || 0) > 0 ? (f.paidAmount > 0 ? 'Remaining' : 'Not Paid') : (f.totalFee > 0 ? 'Paid' : 'Not Paid')}
                </Text>
                <View style={{ width: 120, flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                  {f.receiptUri && (
                    <TouchableOpacity onPress={() => Alert.alert('Receipt', 'Viewing receipt: ' + f.receiptUri)}>
                      <Ionicons name="receipt-outline" size={20} color={COLORS.secondary} />
                    </TouchableOpacity>
                  )}
                  {f.verificationStatus !== 'Verified' ? (
                    <TouchableOpacity onPress={() => handleVerify('fee_payments', f.id, 'Verified')}>
                      <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.success} />
                    </TouchableOpacity>
                  ) : (
                    <Ionicons name="checkmark-done-circle" size={20} color={COLORS.success} />
                  )}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const ActivitiesManagement = ({ filters, handleVerify }: any) => {
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    if (filters) {
      loadActivities();
    }
  }, [filters]);

  const loadActivities = async () => {
    if (!filters?.dept) return;
    const data = await getAllActivitiesByFilter(filters.dept, filters.year, filters.div, filters.sem, filters.activityType);
    setActivities(data);
  };

  const exportActivitiesCSV = () => {
    let csv = 'PRN,Student,Semester,Activity,Type,Date,Status\n';
    activities.forEach(a => {
      csv += `${a.prn},"${a.fullName}",${a.semester},"${a.activityName}","${a.type}","${a.activityDate}","${a.verificationStatus}"\n`;
    });

    if (isWeb) {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Activities_Report_${filters.dept}.csv`;
      a.click();
    } else {
      Alert.alert('Export', 'CSV Exported (Simulation)');
    }
  };

  return (
    <View style={styles.moduleCard}>
      <View style={styles.moduleHeader}>
        <Text style={styles.moduleTitle}>Activities Management</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={exportActivitiesCSV}>
          <Ionicons name="download-outline" size={20} color="#fff" />
          <Text style={styles.actionBtnText}>Export CSV</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.tableCell, { flex: 0.7 }]}>PRN</Text>
          <Text style={[styles.tableCell, { flex: 1 }]}>Student</Text>
          <Text style={[styles.tableCell, { flex: 0.4 }]}>Sem</Text>
          <Text style={[styles.tableCell, { flex: 1.2 }]}>Activity</Text>
          <Text style={[styles.tableCell, { flex: 0.8 }]}>Type</Text>
          <Text style={[styles.tableCell, { flex: 0.7 }]}>Status</Text>
          <Text style={[styles.tableCell, { flex: 0.5 }]}>Actions</Text>
        </View>
        {activities.length > 0 ? (
          activities.map((a, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 0.7 }]}>{a.prn}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{a.fullName}</Text>
              <Text style={[styles.tableCell, { flex: 0.4 }]}>{a.semester}</Text>
              <Text style={[styles.tableCell, { flex: 1.2 }]}>{a.activityName}</Text>
              <Text style={[styles.tableCell, { flex: 0.8 }]}>{a.type}</Text>
              <Text style={[styles.tableCell, { flex: 0.7, color: a.verificationStatus === 'Verified' ? COLORS.success : (a.verificationStatus === 'Rejected' ? COLORS.error : COLORS.warning) }]}>
                {a.verificationStatus}
              </Text>
              <View style={{ flex: 0.5, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                {a.certificateUri && (
                  <TouchableOpacity onPress={() => handleViewDocument(a.certificateUri)}>
                    <Ionicons name="eye-outline" size={20} color={COLORS.secondary} />
                  </TouchableOpacity>
                )}
                {a.verificationStatus !== 'Verified' ? (
                  <TouchableOpacity onPress={() => handleVerify('student_activities', a.id, 'Verified')}>
                    <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.success} />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="checkmark-done-circle" size={20} color={COLORS.success} />
                )}
              </View>
            </View>
          ))
        ) : (
          <Text style={{ padding: 20, textAlign: 'center', color: '#999' }}>No activities found for current filters</Text>
        )}
      </View>
    </View>
  );
};

const AchievementsManagement = ({ filters, handleVerify }: any) => {
  const [achievements, setAchievements] = useState<any[]>([]);

  useEffect(() => {
    if (filters) {
      loadAchievements();
    }
  }, [filters]);

  const loadAchievements = async () => {
    if (!filters?.dept) return;
    const data = await getAchievementsByFilter(filters.dept, filters.year, filters.div, filters.sem);
    setAchievements(data);
  };

  const exportAchievementsCSV = () => {
    let csv = 'PRN,Student,Semester,Achievement,Type,Date,Status\n';
    achievements.forEach(a => {
      csv += `${a.prn},"${a.fullName}",${a.semester},"${a.achievementName}","${a.type}","${a.achievementDate}","${a.verificationStatus}"\n`;
    });

    if (isWeb) {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Achievements_Report_${filters.dept}.csv`;
      a.click();
    } else {
      Alert.alert('Export', 'CSV Exported (Simulation)');
    }
  };

  return (
    <View style={styles.moduleCard}>
      <View style={styles.moduleHeader}>
        <Text style={styles.moduleTitle}>Achievements Management</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={exportAchievementsCSV}>
          <Ionicons name="download-outline" size={20} color="#fff" />
          <Text style={styles.actionBtnText}>Export CSV</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.tableCell, { flex: 0.7 }]}>PRN</Text>
          <Text style={[styles.tableCell, { flex: 1 }]}>Student</Text>
          <Text style={[styles.tableCell, { flex: 0.4 }]}>Sem</Text>
          <Text style={[styles.tableCell, { flex: 1.2 }]}>Achievement</Text>
          <Text style={[styles.tableCell, { flex: 0.8 }]}>Type</Text>
          <Text style={[styles.tableCell, { flex: 0.7 }]}>Status</Text>
          <Text style={[styles.tableCell, { flex: 0.5 }]}>Actions</Text>
        </View>
        {achievements.length > 0 ? (
          achievements.map((a, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 0.7 }]}>{a.prn}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{a.fullName}</Text>
              <Text style={[styles.tableCell, { flex: 0.4 }]}>{a.semester}</Text>
              <Text style={[styles.tableCell, { flex: 1.2 }]}>{a.achievementName}</Text>
              <Text style={[styles.tableCell, { flex: 0.8 }]}>{a.type}</Text>
              <Text style={[styles.tableCell, { flex: 0.7, color: a.verificationStatus === 'Verified' ? COLORS.success : (a.verificationStatus === 'Rejected' ? COLORS.error : COLORS.warning) }]}>
                {a.verificationStatus}
              </Text>
              <View style={{ flex: 0.5, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                {a.certificateUri && (
                  <TouchableOpacity onPress={() => handleViewDocument(a.certificateUri)}>
                    <Ionicons name="eye-outline" size={20} color={COLORS.secondary} />
                  </TouchableOpacity>
                )}
                {a.verificationStatus !== 'Verified' ? (
                  <TouchableOpacity onPress={() => handleVerify('achievements', a.id, 'Verified')}>
                    <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.success} />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="checkmark-done-circle" size={20} color={COLORS.success} />
                )}
              </View>
            </View>
          ))
        ) : (
          <Text style={{ padding: 20, textAlign: 'center', color: '#999' }}>No achievements found for current filters</Text>
        )}
      </View>
    </View>
  );
};

const InternshipsManagement = ({ filters, handleVerify }: any) => {
  const [internships, setInternships] = useState<any[]>([]);

  useEffect(() => {
    if (filters) {
      loadInternships();
    }
  }, [filters]);

  const loadInternships = async () => {
    if (!filters?.dept) return;
    const data = await getAllInternshipsByFilter(filters.dept, filters.year, filters.div, filters.sem);
    setInternships(data);
  };

  const exportInternshipsCSV = () => {
    let csv = 'PRN,Student,Sem,Company,Role,Duration,Status\n';
    internships.forEach(i => {
      csv += `${i.prn},"${i.fullName}",${i.semester},"${i.companyName}","${i.role}",${i.duration},"${i.verificationStatus}"\n`;
    });

    if (isWeb) {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Internships_Report_${filters.dept}.csv`;
      a.click();
    } else {
      Alert.alert('Export', 'CSV Exported (Simulation)');
    }
  };

  return (
    <View style={styles.moduleCard}>
      <View style={styles.moduleHeader}>
        <Text style={styles.moduleTitle}>Internship Management</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={exportInternshipsCSV}>
          <Ionicons name="download-outline" size={20} color="#fff" />
          <Text style={styles.actionBtnText}>Export CSV</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.tableCell, { flex: 0.7 }]}>PRN</Text>
          <Text style={[styles.tableCell, { flex: 1 }]}>Student</Text>
          <Text style={[styles.tableCell, { flex: 0.4 }]}>Sem</Text>
          <Text style={[styles.tableCell, { flex: 1.2 }]}>Company</Text>
          <Text style={[styles.tableCell, { flex: 0.8 }]}>Duration</Text>
          <Text style={[styles.tableCell, { flex: 0.8 }]}>Status</Text>
          <Text style={[styles.tableCell, { flex: 0.5 }]}>Actions</Text>
        </View>
        {internships.length > 0 ? (
          internships.map((i, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 0.7 }]}>{i.prn}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{i.fullName}</Text>
              <Text style={[styles.tableCell, { flex: 0.4 }]}>{i.semester}</Text>
              <Text style={[styles.tableCell, { flex: 1.2 }]}>{i.companyName}</Text>
              <Text style={[styles.tableCell, { flex: 0.8 }]}>{i.duration} Months</Text>
              <Text style={[styles.tableCell, { flex: 0.8, color: i.verificationStatus === 'Verified' ? COLORS.success : (i.verificationStatus === 'Rejected' ? COLORS.error : COLORS.warning) }]}>
                {i.verificationStatus}
              </Text>
              <View style={{ flex: 0.5, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                {i.certificateUri && (
                  <TouchableOpacity onPress={() => handleViewDocument(i.certificateUri)}>
                    <Ionicons name="eye-outline" size={20} color={COLORS.secondary} />
                  </TouchableOpacity>
                )}
                {i.verificationStatus !== 'Verified' ? (
                  <TouchableOpacity onPress={() => handleVerify('internships', i.id, 'Verified')}>
                    <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.success} />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="checkmark-done-circle" size={20} color={COLORS.success} />
                )}
              </View>
            </View>
          ))
        ) : (
          <Text style={{ padding: 20, textAlign: 'center', color: '#999' }}>No internships found for current filters</Text>
        )}
      </View>
    </View>
  );
};

const AnalyticsManagement = ({ students, filters }: any) => {
  const [stats, setStats] = useState<any>({
    total: 0,
    verified: 0,
    pending: 0,
    deptWise: {},
    feeStats: { total: 0, paid: 0 },
    moduleStats: {
      activities: { total: 0, verified: 0 },
      internships: { total: 0, verified: 0 },
      fees: { total: 0, verified: 0 }
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [students, filters]);

  const loadAnalytics = async () => {
    setLoading(true);
    const total = students.length;
    const verified = students.filter((s: any) => s.verificationStatus === 'Verified').length;
    const pending = total - verified;

    const deptWise: Record<string, number> = {};
    students.forEach((s: any) => {
      deptWise[s.branch] = (deptWise[s.branch] || 0) + 1;
    });

    const dept = filters?.dept || 'All';
    const year = filters?.year || 'All';
    const div = filters?.div || 'All';
    const sem = filters?.sem || 'All';
    const activityType = filters?.activityType || 'All';

    const acts = await getAllActivitiesByFilter(dept, year, div, sem, activityType);
    const interns = await getAllInternshipsByFilter(dept, year, div);
    const fees = await getFeePaymentsByFilter(dept, year, div);
    const feeAnalytics = await getFeeAnalytics(dept, year, div);

    setStats({
      total, verified, pending, deptWise,
      feeStats: {
        total: (feeAnalytics?.totalRemainingAmount || 0) + (fees.reduce((acc: number, f: any) => acc + (f.paidAmount || 0), 0)),
        paid: fees.reduce((acc: number, f: any) => acc + (f.paidAmount || 0), 0)
      },
      moduleStats: {
        activities: { total: acts.length, verified: acts.filter((a: any) => a.verificationStatus === 'Verified').length },
        internships: { total: interns.length, verified: interns.filter((i: any) => i.verificationStatus === 'Verified').length },
        fees: { total: fees.length, verified: fees.filter((f: any) => f.verificationStatus === 'Verified').length }
      }
    });
    setLoading(false);
  };

  if (loading) return <ActivityIndicator size="small" color={COLORS.secondary} />;

  return (
    <View>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Students</Text>
          <Text style={styles.statValue}>{stats.total}</Text>
        </View>
        <View style={[styles.statCard, { borderLeftWidth: 4, borderLeftColor: COLORS.success }]}>
          <Text style={styles.statLabel}>Verified (Profiles)</Text>
          <Text style={[styles.statValue, { color: COLORS.success }]}>{stats.verified}</Text>
        </View>
        <View style={[styles.statCard, { borderLeftWidth: 4, borderLeftColor: COLORS.warning }]}>
          <Text style={styles.statLabel}>Pending (Profiles)</Text>
          <Text style={[styles.statValue, { color: COLORS.warning }]}>{stats.pending}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={[styles.moduleCard, { flex: 1 }]}>
          <Text style={styles.moduleTitle}>Fee Collection Progress</Text>
          <View style={{ marginTop: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: COLORS.success }}>
              {stats.feeStats.total > 0 ? ((stats.feeStats.paid / stats.feeStats.total) * 100).toFixed(1) : 0}%
            </Text>
            <Text style={styles.helperText}>Collected of Total ₹{stats.feeStats.total}</Text>
            <View style={{ width: '100%', height: 12, backgroundColor: '#eee', borderRadius: 6, overflow: 'hidden', marginTop: 10 }}>
              <View style={{ height: '100%', backgroundColor: COLORS.success, width: `${(stats.feeStats.paid / (stats.feeStats.total || 1)) * 100}%` }} />
            </View>
          </View>
        </View>

        <View style={[styles.moduleCard, { flex: 1 }]}>
          <Text style={styles.moduleTitle}>Verification Status</Text>
          <View style={{ marginTop: 10 }}>
            <AnalyticsRowComp label="Activities" verified={stats.moduleStats.activities.verified} total={stats.moduleStats.activities.total} color={COLORS.secondary} />
            <AnalyticsRowComp label="Internships" verified={stats.moduleStats.internships.verified} total={stats.moduleStats.internships.total} color={COLORS.warning} />
            <AnalyticsRowComp label="Fee Payments" verified={stats.moduleStats.fees.verified} total={stats.moduleStats.fees.total} color={COLORS.success} />
          </View>
        </View>
      </View>

      <View style={styles.moduleCard}>
        <Text style={styles.moduleTitle}>Department Distribution</Text>
        <View style={{ marginTop: 20 }}>
          {Object.entries(stats.deptWise).map(([dept, count]: any) => (
            <View key={dept} style={{ marginBottom: 15 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={{ fontWeight: '500', color: COLORS.text }}>{dept}</Text>
                <Text style={{ color: COLORS.textLight }}>{count} Students</Text>
              </View>
              <View style={{ height: 10, backgroundColor: '#eee', borderRadius: 5, overflow: 'hidden' }}>
                <View style={{
                  height: '100%',
                  backgroundColor: COLORS.secondary,
                  width: `${(count / (stats.total || 1)) * 100}%`
                }} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const AdminReportsManagement = ({ filters }: any) => {
  const [reportType, setReportType] = useState('attendance');

  // MOCK DATA - For presentation only
  const attendanceData = [
    { label: 'Computer Engineering', value: 85, color: '#4CAF50' },
    { label: 'Electronics & Telecommunication', value: 72, color: '#2196F3' },
    { label: 'Mechanical Engineering', value: 65, color: '#FFC107' },
    { label: 'Civil Engineering', value: 60, color: '#FF5722' },
    { label: 'AI & Data Science', value: 78, color: '#9C27B0' },
  ];

  const feeData = [
    { label: 'Paid', value: 65, color: COLORS.success, count: 450 },
    { label: 'Partial', value: 25, color: COLORS.warning, count: 175 },
    { label: 'Unpaid', value: 10, color: COLORS.error, count: 70 },
  ];

  const academicData = [
    { label: 'Distinction', value: 40, color: '#3F51B5' },
    { label: 'First Class', value: 35, color: '#00BCD4' },
    { label: 'Higher Second', value: 15, color: '#8BC34A' },
    { label: 'Second Class', value: 8, color: '#FFEB3B' },
    { label: 'Fail', value: 2, color: '#F44336' },
  ];

  const renderBarChart = (data: any[], title: string, unit: string = '%') => (
    <View style={styles.moduleCard}>
      <Text style={styles.moduleTitle}>{title}</Text>
      <View style={{ marginTop: 20 }}>
        {data.map((item, index) => (
          <View key={index} style={{ marginBottom: 15 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
              <Text style={{ fontWeight: '600', color: COLORS.text }}>{item.label}</Text>
              <Text style={{ color: COLORS.textLight }}>{item.value}{unit}</Text>
            </View>
            <View style={{ height: 12, backgroundColor: '#f0f0f0', borderRadius: 6, overflow: 'hidden' }}>
              <View style={{
                height: '100%',
                backgroundColor: item.color,
                width: `${item.value}%`,
                borderRadius: 6
              }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const renderDonutChart = (data: any[], title: string) => (
    <View style={styles.moduleCard}>
      <Text style={styles.moduleTitle}>{title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, gap: 10 }}>
        {data.map((item, index) => (
          <View key={index} style={{
            flex: 1, minWidth: '30%',
            backgroundColor: item.color + '15',
            padding: 15,
            borderRadius: 12,
            borderLeftWidth: 4,
            borderLeftColor: item.color,
            alignItems: 'center'
          }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: item.color }}>{item.value}%</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text, marginTop: 4 }}>{item.label}</Text>
            {item.count && <Text style={{ fontSize: 11, color: COLORS.textLight }}>{item.count} Students</Text>}
          </View>
        ))}
      </View>
      <View style={{ marginTop: 20, height: 15, flexDirection: 'row', borderRadius: 8, overflow: 'hidden' }}>
        {data.map((item, index) => (
          <View key={index} style={{ width: `${item.value}%`, backgroundColor: item.color }} />
        ))}
      </View>
    </View>
  );

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {['Attendance', 'Academics', 'Fees'].map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setReportType(type.toLowerCase())}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 20,
                backgroundColor: reportType === type.toLowerCase() ? COLORS.primary : COLORS.white,
                borderWidth: 1,
                borderColor: reportType === type.toLowerCase() ? COLORS.primary : '#eee'
              }}
            >
              <Text style={{
                color: reportType === type.toLowerCase() ? '#fff' : COLORS.text,
                fontWeight: '600'
              }}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {reportType === 'attendance' && renderBarChart(attendanceData, 'Department-wise Attendance Analysis', '%')}
      {reportType === 'academics' && renderBarChart(academicData, 'Overall Academic Performance Distribution', '%')}
      {reportType === 'fees' && renderDonutChart(feeData, 'Fee Collection Status')}

      <View style={styles.moduleCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.moduleTitle}>Export Report</Text>
          <Ionicons name="document-text-outline" size={24} color={COLORS.primary} />
        </View>
        <Text style={{ color: COLORS.textLight, marginTop: 5, marginBottom: 15 }}>
          Download detailed analysis report for {reportType} in PDF format.
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: COLORS.primary,
            padding: 15,
            borderRadius: 8,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 10
          }}
          onPress={() => Alert.alert('Export', `Downloading ${reportType} report... (Simulation)`)}
        >
          <Ionicons name="download-outline" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Download PDF Report</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  headerLeft: { flex: 1 },
  collegeName: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  tagline: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  logoutText: { color: '#fff', marginLeft: 6, fontWeight: '600', fontSize: 13 },
  mainContent: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: Dimensions.get('window').width > 800 ? 220 : 60,
    backgroundColor: COLORS.white,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingVertical: 16,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 4,
    marginHorizontal: 8,
    borderRadius: 12,
  },
  sidebarItemActive: {
    backgroundColor: COLORS.primary,
  },
  sidebarText: { marginLeft: 14, fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  sidebarTextActive: { color: COLORS.white, fontWeight: '600' },
  contentArea: { flex: 1, backgroundColor: COLORS.background },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: 'center',
    gap: 12,
  },

  filterItem: { flexDirection: 'row', alignItems: 'center' },
  filterLabel: { fontSize: 12, fontWeight: '600', marginRight: 8, color: COLORS.textSecondary },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    height: 38,
    justifyContent: 'center',
    width: 130,
  },
  picker: { height: 38, width: '100%', fontSize: 13 },
  scrollContent: { padding: 20 },
  moduleCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 20,
  },
  moduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  moduleTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  refreshBtn: { padding: 8, borderRadius: 8, backgroundColor: COLORS.primary + '10' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  actionBtnText: { color: '#fff', marginLeft: 8, fontWeight: '600', fontSize: 13 },
  table: { marginTop: 10 },
  tableRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, alignItems: 'center' },
  tableHeader: { backgroundColor: COLORS.background, borderTopWidth: 1, borderTopColor: COLORS.border },
  tableCell: { fontSize: 13, color: COLORS.text, paddingHorizontal: 6 },
  helperText: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 15 },
  editIcon: { padding: 5 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: COLORS.white, padding: 16, borderRadius: 14, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center' },
  modalBody: { backgroundColor: COLORS.white, width: '90%', maxWidth: 420, borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: COLORS.text, textAlign: 'center' },
  modalContent: { backgroundColor: COLORS.white, width: '90%', maxWidth: 420, borderRadius: 20, padding: 24 },
  label: { fontSize: 13, fontWeight: 'bold', color: COLORS.text, marginBottom: 8, marginTop: 10 },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  input: { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 14, backgroundColor: COLORS.background },
  row: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  cancelBtn: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  saveBtn: { backgroundColor: COLORS.primary },
  smallInput: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
    textAlign: 'center',
    backgroundColor: COLORS.white,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 12,
  },
  detailSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    paddingLeft: 10,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 3,
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  btnText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 14,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  checkboxLabel: {
    marginLeft: 12,
    fontSize: 14,
    color: COLORS.text,
  },
  // GFM Action Dashboard Styles
  smallStatusBtn: {
    flex: 1,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  smallStatusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textLight,
  },
  // Admin Reports & Audit Styles
  reportSessionCard: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sessionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  sessionMetaText: {
    fontSize: 12,
    color: COLORS.text,
  },
  auditContainer: {
    marginTop: 5,
  },
  auditItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    paddingRight: 10,
  },
  auditText: {
    fontSize: 11,
    color: COLORS.text,
    flex: 1,
    lineHeight: 16,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
  },
  toggleBtnActive: {
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: COLORS.primary,
  },
  moduleSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  moduleSwitchBtnActive: {
    backgroundColor: COLORS.primary,
  },
  moduleSwitchText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textLight,
  },
  moduleSwitchTextActive: {
    color: '#fff',
  },
  searchSuggestionsBox: {
    position: 'absolute',
    top: 45,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingVertical: 5,
    zIndex: 9999,
  },
  searchSuggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  suggestionSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  absentRollsText: {
    fontSize: 14,
    color: COLORS.error,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  attendanceSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eee',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  absentRollsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignItems: 'center',
  },
  absentRollsLabel: {
    fontSize: 13,
    color: COLORS.textLight,
    fontWeight: '600',
  },
});

