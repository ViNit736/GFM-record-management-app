import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { 
  getAllStudents,
  getStudentRecords,
  updateVerificationStatus,
  Student,
  FeePayment,
  TechnicalActivity,
  NonTechnicalActivity,
  Internship,
  CourseDef,
  getAllCoursesDef,
  saveCourseDef,
  getFeeAnalytics,
  getAcademicRecordsByFilter,
    saveAcademicRecord,
    getAcademicRecordsByStudent,
    getAchievements,
    getFeePaymentsByFilter,
    getFeePayments,
    getStudentActivities,
    getTechnicalActivities,
    getNonTechnicalActivities,
    getInternships,
    getAllActivitiesByFilter,
    getAllInternshipsByFilter,
    getAchievementsByFilter
  } from '../../storage/sqlite';
import { getSession, clearSession } from '../../services/session.service';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { populateTemplate } from '../../services/pdf-template.service';
import { COLORS } from '../../constants/colors';

// Ensure jsPDF can find html2canvas if needed
if (typeof window !== 'undefined') {
  const h2c = require('html2canvas');
  (window as any).html2canvas = h2c.default || h2c;
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

const exportStudentPDF = async (student: Student, options: any, setLoading: (v: boolean) => void) => {
  if (!isWeb) {
    Alert.alert('Export', 'PDF Export is available on Web portal.');
    return;
  }

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
    let academicTableHtml = '<table><thead><tr><th>Sem</th><th>Code</th><th>Course</th><th>ISE</th><th>MSE</th><th>ESE</th><th>Total</th><th>Grade</th></tr></thead><tbody>';
    if (academicRecords.length > 0) {
      academicRecords.forEach(r => {
        academicTableHtml += `<tr><td>${r.semester}</td><td>${r.courseCode}</td><td>${r.courseName}</td><td>${r.iseMarks || 0}</td><td>${r.mseMarks || 0}</td><td>${r.eseMarks || 0}</td><td>${r.totalMarks}</td><td style="color: ${r.grade === 'F' ? COLORS.error : 'inherit'}">${r.grade}</td></tr>`;
      });
    } else {
      academicTableHtml += '<tr><td colspan="8" style="text-align: center;">No academic records found</td></tr>';
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

    const b64LogoLeft = await getBase64Image(LOGO_LEFT);
    const b64LogoRight = await getBase64Image(LOGO_RIGHT);
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

    const html = populateTemplate(dataMap, false);

    // Create a hidden container to render HTML
    const container = document.createElement('div');
    container.style.position = 'fixed'; // Use fixed instead of absolute
    container.style.top = '0';
    container.style.left = '-10000px';
    container.style.width = '210mm';
    container.style.backgroundColor = 'white';
    container.style.zIndex = '-9999';
    container.innerHTML = html;
    document.body.appendChild(container);

    // Ensure all images in the container are loaded before capturing
    const images = container.getElementsByTagName('img');
    const imagePromises = Array.from(images).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve; // Continue even if an image fails
      });
    });

    await Promise.all(imagePromises);
    await new Promise(resolve => setTimeout(resolve, 800)); // Extra wait for layout

    const html2canvas = (window as any).html2canvas;
    if (!html2canvas) {
      document.body.removeChild(container);
      throw new Error('html2canvas library is missing');
    }

    const canvas = await html2canvas(container, {
      useCORS: true,
      scale: 2,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 800
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pdfWidth = 210;
    const pdfHeight = 297;
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 0;

    // Add pages
    doc.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      doc.addPage();
      doc.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;
    }

    doc.save(`${student.prn}_Academic_Report_${new Date().getTime()}.pdf`);
    document.body.removeChild(container);
    setLoading(false);

  } catch (error) {
    console.error('Error generating PDF:', error);
    Alert.alert('Error', 'Failed to generate PDF. Please check your connection and try again.');
    setLoading(false);
  }
};

type Module = 'courses' | 'students' | 'academic' | 'fee' | 'activities' | 'achievements' | 'internships' | 'analytics';

export default function TeacherDashboard() {
  const [currentModule, setCurrentModule] = useState<Module>('students');
  const [loading, setLoading] = useState(true);
  const [teacherPrn, setTeacherPrn] = useState('');
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
            <Checkbox label="Personal Details (Always included)" value={true} onValueChange={() => {}} disabled={true} />
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

  const [deptFilter, setDeptFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState('All');
  const [divFilter, setDivFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [semFilter, setSemFilter] = useState<number | 'All'>('All');
  const [activityTypeFilter, setActivityTypeFilter] = useState<'All' | 'Extra-curricular' | 'Co-curricular' | 'Courses'>('All');

  const router = useRouter();

  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    const init = async () => {
      await checkAuth();
      await loadData();
    };
    init();
  }, [deptFilter, yearFilter, divFilter, searchQuery, currentModule, semFilter, activityTypeFilter]);

  const checkAuth = async () => {
    const session = await getSession();
    if (!session || (session.role !== 'teacher' && session.role !== 'admin')) {
      router.replace('/login');
    } else {
      setTeacherPrn(session.prn);
      setUserRole(session.role);
    }
  };

  const loadData = async () => {
    const session = await getSession();
    if (!session) return;
    
    setLoading(true);
    try {
      const allStudents = await getAllStudents();
      setStudents(allStudents);
      
      let filtered = allStudents;
      if (deptFilter !== 'All') filtered = filtered.filter(s => s.branch === deptFilter);
      if (yearFilter !== 'All') filtered = filtered.filter(s => s.yearOfStudy === yearFilter);
      if (divFilter !== 'All') filtered = filtered.filter(s => s.division === divFilter);
      
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
          if (deptFilter !== 'All') {
            filteredCourses = filteredCourses.filter(course => course.department === deptFilter);
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

  const SidebarItem = ({ title, icon, module }: { title: string, icon: any, module: Module }) => (
    <TouchableOpacity 
      style={[styles.sidebarItem, currentModule === module && styles.sidebarItemActive]}
      onPress={() => setCurrentModule(module)}
    >
      <Ionicons name={icon} size={24} color={currentModule === module ? '#fff' : COLORS.textLight} />
      {width > 800 && <Text style={[styles.sidebarText, currentModule === module && styles.sidebarTextActive]}>{title}</Text>}
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.collegeName}>GFM Record</Text>
          <Text style={styles.tagline}>{userRole === 'admin' ? 'Management Portal' : 'Faculty Portal'}</Text>
        </View>
      <TouchableOpacity onPress={async () => { await clearSession(); router.replace('/login'); }} style={styles.logoutBtn}>
        <Ionicons name="log-out-outline" size={20} color="#fff" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFilters = () => (
    <View style={styles.filterContainer}>
      <View style={styles.filterItem}>
        <Text style={styles.filterLabel}>Department</Text>
        <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={deptFilter}
              onValueChange={setDeptFilter}
              style={styles.picker}
            >
              <Picker.Item label="All" value="All" />
              <Picker.Item label="CSE" value="CSE" />
              <Picker.Item label="IT" value="IT" />
              <Picker.Item label="ECE" value="ECE" />
              <Picker.Item label="ME" value="ME" />
              <Picker.Item label="CE" value="CE" />
              <Picker.Item label="EE" value="EE" />
              <Picker.Item label="AIDS" value="AIDS" />
              <Picker.Item label="AIML" value="AIML" />
            </Picker>
        </View>
      </View>
      <View style={styles.filterItem}>
        <Text style={styles.filterLabel}>Year</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={yearFilter}
            onValueChange={setYearFilter}
            style={styles.picker}
          >
            <Picker.Item label="All" value="All" />
            <Picker.Item label="1st Year" value="1st Year" />
            <Picker.Item label="2nd Year" value="2nd Year" />
            <Picker.Item label="3rd Year" value="3rd Year" />
            <Picker.Item label="4th Year" value="4th Year" />
          </Picker>
        </View>
      </View>
      <View style={styles.filterItem}>
        <Text style={styles.filterLabel}>Division</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={divFilter}
            onValueChange={setDivFilter}
            style={styles.picker}
          >
            <Picker.Item label="All" value="All" />
            <Picker.Item label="A" value="A" />
            <Picker.Item label="B" value="B" />
            <Picker.Item label="C" value="C" />
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
      
      <View style={[styles.filterItem, { minWidth: 250 }]}>
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
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      <View style={styles.mainContent}>
            <View style={styles.sidebar}>
              <SidebarItem title="Analytics" icon="analytics-outline" module="analytics" />
              <SidebarItem title="Courses" icon="book-outline" module="courses" />
              <SidebarItem title="Students" icon="people-outline" module="students" />
              <SidebarItem title="Academic" icon="school-outline" module="academic" />
              <SidebarItem title="Fees" icon="cash-outline" module="fee" />
              <SidebarItem title="Activities" icon="star-outline" module="activities" />
              <SidebarItem title="Achievements" icon="trophy-outline" module="achievements" />
              <SidebarItem title="Internships" icon="briefcase-outline" module="internships" />
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
                        filters={{ dept: deptFilter, year: yearFilter, div: divFilter, sem: semFilter, activityType: activityTypeFilter }}
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
        </View>

    );
  }

    const ModuleRenderer = ({ module, students, courses, filters, setSelectedStudentForDetails, setSelectedStudentForAcademicView, setStudentForPrint, setPrintOptionsVisible, handleVerify, loadData }: any) => {
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
    default: return <Text>Select a module</Text>;
  }
};

  const AcademicViewModal = ({ student, visible, onClose }: { student: Student, visible: boolean, onClose: () => void }) => {
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
                      <Text style={[styles.tableCell, { flex: 0.6 }]}>ISE</Text>
                      <Text style={[styles.tableCell, { flex: 0.6 }]}>MSE</Text>
                      <Text style={[styles.tableCell, { flex: 0.6 }]}>ESE</Text>
                      <Text style={[styles.tableCell, { flex: 0.8 }]}>Total</Text>
                      <Text style={[styles.tableCell, { flex: 0.6 }]}>Grade</Text>
                    </View>
                    {academicRecords.map((r, idx) => (
                      <View key={idx} style={styles.tableRow}>
                        <Text style={[styles.tableCell, { flex: 0.5 }]}>{r.semester}</Text>
                        <Text style={[styles.tableCell, { flex: 2 }]}>{r.courseName}</Text>
                        <Text style={[styles.tableCell, { flex: 0.6 }]}>{r.iseMarks || 0}</Text>
                        <Text style={[styles.tableCell, { flex: 0.6 }]}>{r.mseMarks || 0}</Text>
                        <Text style={[styles.tableCell, { flex: 0.6 }]}>{r.eseMarks || 0}</Text>
                        <Text style={[styles.tableCell, { flex: 0.8 }]}>{r.totalMarks}</Text>
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

        let academicTable = '<table><thead><tr><th>Sem</th><th>Course</th><th>ISE</th><th>MSE</th><th>ESE</th><th>Total</th><th>Grade</th></tr></thead><tbody>';
        if (academicRecords.length > 0) {
          academicRecords.forEach(r => {
            academicTable += `<tr><td>${r.semester}</td><td>${r.courseName}</td><td>${r.iseMarks || 0}</td><td>${r.mseMarks || 0}</td><td>${r.eseMarks || 0}</td><td>${r.totalMarks}</td><td>${r.grade}</td></tr>`;
          });
        } else {
          academicTable += '<tr><td colspan="7">No academic records</td></tr>';
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

        const b64LogoLeft = await getBase64Image(LOGO_LEFT);
        const b64LogoRight = await getBase64Image(LOGO_RIGHT);
        const b64StudentPhoto = await getBase64Image(student.photoUri || 'https://via.placeholder.com/150');

        const dataMap = {
          college_logo_left: b64LogoLeft,
          college_logo_right: b64LogoRight,
          report_title: "Full Student Academic Record",
          gen_date: new Date().toLocaleDateString(),
          filters_used: `${student.branch} | ${student.yearOfStudy} | Div: ${student.division}`,
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
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
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
            <Text style={styles.sectionTitle}>Academic Status</Text>
            <View style={styles.detailGrid}>
              <DetailItem label="Department" value={student.branch} />
              <DetailItem label="Year" value={student.yearOfStudy} />
              <DetailItem label="Division" value={student.division} />
              <DetailItem label="Verification" value={student.verificationStatus} color={student.verificationStatus === 'Verified' ? COLORS.success : COLORS.warning} />
            </View>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Contact & Address</Text>
            <View style={styles.detailGrid}>
              <DetailItem label="Phone" value={student.phone} />
              <DetailItem label="Email" value={student.email} />
              <DetailItem label="Pincode" value={student.pincode} />
              <DetailItem label="Permanent Address" value={student.permanentAddress} fullWidth />
              <DetailItem label="Temporary Address" value={student.temporaryAddress} fullWidth />
            </View>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Family Details</Text>
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
              <Text style={styles.sectionTitle}>Education History</Text>
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

  const StudentManagement = ({ students, filters, onViewDetails, onPrint, handleVerify }: { students: Student[], filters: any, onViewDetails: (s: Student) => void, onPrint: (s: Student) => void, handleVerify: any }) => {
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
          <Text style={[styles.tableCell, { flex: 1 }]}>{s.branch}</Text>
          <Text style={[styles.tableCell, { flex: 0.6 }]}>{s.yearOfStudy}</Text>
          <Text style={[styles.tableCell, { flex: 0.5 }]}>{s.division}</Text>
            <View style={{ flex: 0.8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
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
                  onValueChange={v => setNewCourse({...newCourse, department: v})}
                >
                  {['CSE', 'IT', 'ECE', 'ME', 'CE', 'EE', 'AIDS', 'AIML'].map(d => (
                    <Picker.Item key={d} label={d} value={d} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.filterLabel}>Course Code</Text>
              <TextInput placeholder="Course Code" style={styles.input} value={newCourse.courseCode} onChangeText={t => setNewCourse({...newCourse, courseCode: t})} />
              
              <Text style={styles.filterLabel}>Course Name</Text>
              <TextInput placeholder="Course Name" style={styles.input} value={newCourse.courseName} onChangeText={t => setNewCourse({...newCourse, courseName: t})} />
            
            <View style={styles.row}>
              <View style={{flex: 1}}>
                <Text style={styles.filterLabel}>Credits</Text>
                <TextInput placeholder="Credits" style={styles.input} keyboardType="numeric" value={newCourse.credits.toString()} onChangeText={t => setNewCourse({...newCourse, credits: parseInt(t)||0})} />
              </View>
              <View style={{flex: 1, marginLeft: 10}}>
                <Text style={styles.filterLabel}>Semester</Text>
                <TextInput placeholder="Semester" style={styles.input} keyboardType="numeric" value={newCourse.semester.toString()} onChangeText={t => setNewCourse({...newCourse, semester: parseInt(t)||0})} />
              </View>
            </View>

            <View style={styles.row}>
              <View style={{flex: 1}}>
                <Text style={styles.filterLabel}>ISE Max</Text>
                <TextInput placeholder="ISE Max" style={styles.input} keyboardType="numeric" value={newCourse.iseMax.toString()} onChangeText={t => setNewCourse({...newCourse, iseMax: parseInt(t)||0})} />
              </View>
              <View style={{flex: 1, marginLeft: 10}}>
                <Text style={styles.filterLabel}>MSE Max</Text>
                <TextInput placeholder="MSE Max" style={styles.input} keyboardType="numeric" value={newCourse.mseMax.toString()} onChangeText={t => setNewCourse({...newCourse, mseMax: parseInt(t)||0})} />
              </View>
              <View style={{flex: 1, marginLeft: 10}}>
                <Text style={styles.filterLabel}>ESE Max</Text>
                <TextInput placeholder="ESE Max" style={styles.input} keyboardType="numeric" value={newCourse.eseMax.toString()} onChangeText={t => setNewCourse({...newCourse, eseMax: parseInt(t)||0})} />
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
  }, [filters, students, selectedStudent]); 

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
  const filteredCourses = c.filter(course => 
    (deptToUse === 'All' || course.department === deptToUse) && 
    (filters.sem === 'All' || course.semester === filters.sem)
  );
  setCourses(filteredCourses);

  if (selectedStudent) {
    const existing = await getAcademicRecordsByStudent(selectedStudent.prn);
    const marksMap: Record<number, any> = {};
    existing.forEach(r => {
      if (filters.sem === 'All' || r.semester === filters.sem) {
        marksMap[r.courseDefId] = r;
      }
    });
    setMarks(marksMap);
    const semRecord = filters.sem === 'All' ? existing[existing.length - 1] : existing.find(r => r.semester === filters.sem);
    if (semRecord) {
      setSgpa(semRecord.sgpa.toString());
      setCgpa(semRecord.cgpa.toString());
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
          totalMarks: (Number(m.iseMarks)||0) + (Number(m.mseMarks)||0) + (Number(m.eseMarks)||0),
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
setMarks(prev => ({
  ...prev,
  [courseId]: {
    ...(prev[courseId] || { iseMarks: 0, mseMarks: 0, eseMarks: 0, grade: 'F' }),
    [field]: field === 'grade' ? value : value
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
          <Text style={styles.modalTitle}>Enter Marks: {selectedStudent?.fullName}</Text>
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
const [feeStatusFilter, setFeeStatusFilter] = useState<'All' | 'Paid' | 'Remaining'>('All');

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
  if (feeStatusFilter === 'Remaining') return (f.lastBalance || 0) > 0;
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
        <Text style={[styles.statValue, {color: COLORS.error}]}>{stats?.studentsWithRemaining || 0}</Text>
      </View>
      <View style={[styles.statCard, {flex: 1.5}]}>
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
              <Picker.Item label="Remaining" value="Remaining" />
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
                {(f.lastBalance || 0) > 0 ? 'Remaining' : (f.totalFee > 0 ? 'Paid' : 'Unpaid')}
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
                  <TouchableOpacity onPress={() => Alert.alert('Certificate', 'Viewing: ' + a.certificateUri)}>
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
          <Text style={{padding: 20, textAlign: 'center', color: '#999'}}>No activities found for current filters</Text>
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
                  <TouchableOpacity onPress={() => Alert.alert('Certificate', 'Viewing: ' + a.certificateUri)}>
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
          <Text style={{padding: 20, textAlign: 'center', color: '#999'}}>No achievements found for current filters</Text>
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
                  <TouchableOpacity onPress={() => Alert.alert('Certificate', 'Viewing: ' + i.certificateUri)}>
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
          <Text style={{padding: 20, textAlign: 'center', color: '#999'}}>No internships found for current filters</Text>
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
            <AnalyticsRow label="Activities" verified={stats.moduleStats.activities.verified} total={stats.moduleStats.activities.total} color={COLORS.secondary} />
            <AnalyticsRow label="Internships" verified={stats.moduleStats.internships.verified} total={stats.moduleStats.internships.total} color={COLORS.warning} />
            <AnalyticsRow label="Fee Payments" verified={stats.moduleStats.fees.verified} total={stats.moduleStats.fees.total} color={COLORS.success} />
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

const AnalyticsRow = ({ label, verified, total, color }: any) => (
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

const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: '#f0f2f5' },
header: {
  backgroundColor: COLORS.primary,
  paddingTop: 40,
  paddingBottom: 15,
  paddingHorizontal: 20,
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  zIndex: 10,
},
headerLeft: { flex: 1 },
collegeName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
tagline: { color: '#BDC3C7', fontSize: 12 },
logoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.error, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
logoutText: { color: '#fff', marginLeft: 5, fontWeight: 'bold', fontSize: 13 },
mainContent: { flex: 1, flexDirection: 'row' },
sidebar: {
  width: width > 800 ? 240 : 60,
  backgroundColor: '#fff',
  borderRightWidth: 1,
  borderRightColor: '#eee',
  paddingVertical: 20,
},
sidebarItem: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 15,
  paddingHorizontal: 15,
  marginBottom: 5,
},
sidebarItemActive: {
  backgroundColor: COLORS.secondary,
  borderTopRightRadius: 25,
  borderBottomRightRadius: 25,
  marginRight: 10,
},
sidebarText: { marginLeft: 15, fontSize: 15, color: COLORS.textLight, fontWeight: '500' },
sidebarTextActive: { color: '#fff', fontWeight: 'bold' },
contentArea: { flex: 1 },
filterContainer: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  padding: 10,
  backgroundColor: '#fff',
  borderBottomWidth: 1,
  borderBottomColor: '#eee',
  alignItems: 'center',
  gap: 10,
},

filterItem: { flexDirection: 'row', alignItems: 'center' },
filterLabel: { fontSize: 13, fontWeight: 'bold', marginRight: 8, color: COLORS.textLight },
pickerWrapper: {
  borderWidth: 1,
  borderColor: '#eee',
  borderRadius: 8,
  backgroundColor: '#fafafa',
  height: 35,
  justifyContent: 'center',
  width: 130,
},
picker: { height: 35, width: '100%', fontSize: 13 },
scrollContent: { padding: 20 },
moduleCard: {
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 20,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
  marginBottom: 20,
},
moduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
moduleTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.secondary, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
actionBtnText: { color: '#fff', marginLeft: 8, fontWeight: 'bold' },
table: { marginTop: 10 },
tableRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', alignItems: 'center' },
tableHeader: { backgroundColor: '#f8f9fa', borderTopWidth: 1, borderTopColor: '#eee' },
tableCell: { fontSize: 13, color: COLORS.text, paddingHorizontal: 5 },
helperText: { fontSize: 13, color: COLORS.textLight, marginBottom: 15 },
editIcon: { padding: 5 },
statsRow: { flexDirection: 'row', gap: 15, marginBottom: 20 },
statCard: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 12, elevation: 2 },
statLabel: { fontSize: 12, color: COLORS.textLight, marginBottom: 5 },
statValue: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
modalBody: { backgroundColor: '#fff', width: '90%', maxWidth: 400, borderRadius: 15, padding: 25 },
modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: COLORS.primary },
input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 14 },
row: { flexDirection: 'row', gap: 10 },
btn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
cancelBtn: { backgroundColor: '#eee' },
saveBtn: { backgroundColor: COLORS.secondary },
smallInput: {
  borderWidth: 1,
  borderColor: '#ddd',
  borderRadius: 6,
  padding: 8,
  fontSize: 12,
  textAlign: 'center',
  backgroundColor: '#fff',
},
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  detailSection: {
    marginBottom: 25,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.secondary,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.secondary,
    paddingLeft: 10,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  checkboxLabel: {
    marginLeft: 12,
    fontSize: 14,
    color: COLORS.text,
  },
});
