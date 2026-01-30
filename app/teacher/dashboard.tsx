import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import {
  CourseDef,
  getAllCoursesDef,
  getAllStudents,
  getDistinctYearsOfStudy,
  getTeacherBatchConfig,
  saveStudentInfo,
  Student
} from '../../storage/sqlite';

import { COLORS } from '../../constants/colors';
import { BRANCH_MAPPINGS, DISPLAY_YEARS, YEAR_MAPPINGS } from '../../constants/Mappings';
import { clearSession, getSession } from '../../services/session.service';

import { AcademicViewModal } from '../../components/teacher/AcademicViewModal';
import { styles } from '../../components/teacher/dashboard.styles';
import { exportStudentPDF, handleViewDocument } from '../../components/teacher/dashboard.utils';
import { ModuleRenderer } from '../../components/teacher/ModuleRenderer';
import { PrintOptionsModal } from '../../components/teacher/PrintOptionsModal';
import { QuickEditModal } from '../../components/teacher/QuickEditModal';
import { StudentDetailsModal } from '../../components/teacher/StudentDetailsModal';

const isWeb = Platform.OS === 'web';

type Module = 'courses' | 'students' | 'academic' | 'fees' | 'activities' | 'achievements' | 'internships' | 'analytics' | 'attendance' | 'attendance-summary' | 'admin-reports' | 'batch-info' | 'manage-staff' | 'daily-attendance' | 'register-student';

export default function TeacherDashboard() {
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams();
  const initialModuleParam = params?.module as Module | undefined;

  const [currentModule, setCurrentModule] = useState<Module>('analytics');
  const [activeModuleGroup, setActiveModuleGroup] = useState<'Attendance' | 'GFM' | 'ADMIN'>('Attendance');
  const [loading, setLoading] = useState(true);
  const [teacherId, setTeacherId] = useState('');
  const [teacherPrn, setTeacherPrn] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [teacherDept, setTeacherDept] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<CourseDef[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);

  // Selection states for Modals
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState<Student | null>(null);
  const [selectedStudentForAcademicView, setSelectedStudentForAcademicView] = useState<Student | null>(null);
  const [studentForPrint, setStudentForPrint] = useState<Student | null>(null);
  const [printOptionsVisible, setPrintOptionsVisible] = useState(false);
  const [printOptions, setPrintOptions] = useState({
    personal: true, academic: false, fees: false, activities: false, internships: false, all: false,
  });

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSection, setEditingSection] = useState<string>('');
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [editData, setEditData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(Platform.OS === 'web' && width > 1024 ? false : true);
  const [batchConfig, setBatchConfig] = useState<any>(null);

  // Filters
  const [gfmDeptFilter, setGfmDeptFilter] = useState('All');
  const [gfmYearFilter, setGfmYearFilter] = useState('All');
  const [gfmDivFilter, setGfmDivFilter] = useState('All');
  const [attDeptFilter, setAttDeptFilter] = useState('All');
  const [attYearFilter, setAttYearFilter] = useState('All');
  const [attDivFilter, setAttDivFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [semFilter, setSemFilter] = useState<number | 'All'>('All');
  const [activityTypeFilter, setActivityTypeFilter] = useState<'All' | 'Extra-curricular' | 'Co-curricular' | 'Courses'>('All');

  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [yearsOfStudy, setYearsOfStudy] = useState<string[]>([]);

  useEffect(() => {
    checkSession();
    loadYears();
  }, []);

  const checkSession = async () => {
    const session = await getSession();
    if (!session) {
      router.replace('/');
      return;
    }
    setTeacherId(session.id);
    setTeacherPrn(session.prn ?? '');
    setTeacherName(session.fullName ?? '');
    setTeacherDept(session.department ?? '');
    setUserRole(session.role ?? '');

    if (session.role === 'admin') {
      const defaultModule = initialModuleParam || 'admin-reports';
      setCurrentModule(defaultModule);
      setActiveModuleGroup('ADMIN');
    } else if (initialModuleParam) {
      setCurrentModule(initialModuleParam);
    }
    loadData(session.role, session.prn, session.id);
  };

  const loadYears = async () => {
    const years = await getDistinctYearsOfStudy();
    setYearsOfStudy(years);
  };

  useEffect(() => {
    if (userRole) {
      loadData();
    }
  }, [attDeptFilter, attYearFilter, attDivFilter, gfmDeptFilter, gfmYearFilter, gfmDivFilter, activeModuleGroup]);

  const loadData = async (roleOverride?: string, prnOverride?: string, idOverride?: string) => {
    setLoading(true);
    try {
      const allStudents = await getAllStudents();
      const session = await getSession();
      const role = roleOverride || session?.role || userRole;
      const prn = prnOverride || session?.prn || teacherPrn;
      const tId = idOverride || session?.id || teacherId;
      const name = session?.fullName || teacherName;

      // Fetch batch assignment
      const config = await getTeacherBatchConfig(tId);
      setBatchConfig(config);

      let filtered = allStudents;
      if (role === 'teacher') {
        // Strict filtering: If batch config exists, use it as primary filter.
        // Otherwise fallback to direct GFM assignment.
        filtered = allStudents.filter(s => {
          if (config) {
            const matchDept = s.branch === config.department;

            // Normalize year (e.g., 'SE' and 'Second Year' both become 'Second Year')
            const normalizedConfigYear = YEAR_MAPPINGS[config.class] || config.class;
            const normalizedStudentYear = YEAR_MAPPINGS[s.yearOfStudy] || s.yearOfStudy;
            const matchYear = normalizedConfigYear === normalizedStudentYear;

            // Normalize division (e.g., 'A2' becomes 'A')
            const configMainDiv = config.division ? config.division[0].toUpperCase() : '';
            const studentMainDiv = s.division ? s.division[0].toUpperCase() : '';
            const matchDiv = configMainDiv === studentMainDiv;

            if (matchDept && matchYear && matchDiv) {
              const rollNo = parseInt(s.prn.slice(-3));
              const fromVal = parseInt(config.rbtFrom);
              const toVal = parseInt(config.rbtTo);

              if (!isNaN(rollNo) && !isNaN(fromVal) && !isNaN(toVal)) {
                return rollNo >= fromVal && rollNo <= toVal;
              }
            }
            return false;
          }

          // Fallback to direct GFM match if no batch config
          const isGfmForStudent = (s.gfmId && (s.gfmId === prn || s.gfmId === tId)) ||
            (s.gfmName && name && s.gfmName.toLowerCase() === name.toLowerCase());

          return isGfmForStudent;
        });
      } else if (role === 'admin') {
        // Admin filtering logic
        const isAttendance = activeModuleGroup === 'Attendance' || currentModule === 'admin-reports';
        const dept = isAttendance ? attDeptFilter : gfmDeptFilter;
        const year = isAttendance ? attYearFilter : gfmYearFilter;
        const div = isAttendance ? attDivFilter : gfmDivFilter;

        filtered = allStudents.filter(s => {
          const matchDept = dept === 'All' || s.branch === dept;
          const normalizedStudentYear = YEAR_MAPPINGS[s.yearOfStudy] || s.yearOfStudy;
          const matchYear = year === 'All' || normalizedStudentYear === year;
          const matchDiv = div === 'All' || (s.division && s.division.startsWith(div));
          return matchDept && matchYear && matchDiv;
        });
      }

      setStudents(filtered);
      setFilteredStudents(filtered);
      const allCourses = await getAllCoursesDef();
      setCourses(allCourses);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const logout = async () => {
      await clearSession();
      router.replace('/');
    };

    if (isWeb) {
      if (window.confirm("Are you sure you want to logout?")) logout();
    } else {
      Alert.alert("Logout", "Are you sure?", [
        { text: "Cancel" },
        { text: "Logout", style: "destructive", onPress: logout }
      ]);
    }
  };

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
      if (selectedStudentForDetails && selectedStudentForDetails.prn === editData.prn) {
        setSelectedStudentForDetails(editData);
      }
    } catch (e: any) {
      console.error('Error updating student:', e);
      const errorMsg = e?.message || e?.code || 'Failed to update student information';
      Alert.alert('Database Error', `Could not save changes: ${errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const SidebarItem = ({ id, icon, label, group }: { id: Module, icon: any, label: string, group: 'Attendance' | 'GFM' | 'ADMIN' }) => (
    <TouchableOpacity
      style={[
        styles.sidebarItem,
        currentModule === id && styles.sidebarItemActive,
        isSidebarCollapsed && { paddingHorizontal: 0, justifyContent: 'center' }
      ]}
      onPress={() => {
        setCurrentModule(id);
        setActiveModuleGroup(group);
        // Auto-close sidebar on mobile after selection
        if (Platform.OS !== 'web' || width <= 800) {
          setIsSidebarCollapsed(true);
        }
      }}
    >
      <Ionicons name={icon} size={22} color={currentModule === id ? '#fff' : COLORS.textSecondary} />
      {!isSidebarCollapsed && width > 800 && (
        <Text style={[styles.sidebarText, currentModule === id && styles.sidebarTextActive]}>{label}</Text>
      )}
    </TouchableOpacity>
  );

  const renderFilters = () => {
    const isAttendance = activeModuleGroup === 'Attendance';
    const isTeacher = userRole === 'teacher';

    if (isTeacher) {
      return (
        <View style={styles.filterContainer}>
          <View style={[styles.filterItem, { flex: 1, minWidth: 200 }]}>
            <Ionicons name="search-outline" size={20} color={COLORS.textLight} style={{ position: 'absolute', left: 12, zIndex: 1 }} />
            <TextInput
              style={[styles.input, { flex: 1, paddingLeft: 40, marginBottom: 0 }]}
              placeholder="Search students..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>
      );
    }

    const dept = isAttendance ? attDeptFilter : gfmDeptFilter;
    const year = isAttendance ? attYearFilter : gfmYearFilter;
    const div = isAttendance ? attDivFilter : gfmDivFilter;
    const setDept = isAttendance ? setAttDeptFilter : setGfmDeptFilter;
    const setYear = isAttendance ? setAttYearFilter : setGfmYearFilter;
    const setDiv = isAttendance ? setAttDivFilter : setGfmDivFilter;

    return (
      <View style={styles.filterContainer}>
        <View style={styles.filterItem}>
          <Text style={styles.filterLabel}>Dept:</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={dept} onValueChange={setDept} style={styles.picker}>
              <Picker.Item label="All" value="All" />
              {Object.keys(BRANCH_MAPPINGS).map(key => (
                <Picker.Item key={key} label={BRANCH_MAPPINGS[key]} value={key} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.filterItem}>
          <Text style={styles.filterLabel}>Year:</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={year} onValueChange={setYear} style={styles.picker}>
              <Picker.Item label="All" value="All" />
              {DISPLAY_YEARS.map(y => (
                <Picker.Item key={y.value} label={y.label} value={y.value} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.filterItem}>
          <Text style={styles.filterLabel}>Div:</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={div} onValueChange={setDiv} style={styles.picker}>
              <Picker.Item label="All" value="All" />
              {['A', 'B', 'C', 'D'].map(d => (
                <Picker.Item key={d} label={d} value={d} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={[styles.filterItem, { flex: 1, minWidth: 200 }]}>
          <Ionicons name="search-outline" size={20} color={COLORS.textLight} style={{ position: 'absolute', left: 12, zIndex: 1 }} />
          <TextInput
            style={[styles.input, { flex: 1, paddingLeft: 40, marginBottom: 0 }]}
            placeholder="Search students..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => setIsSidebarCollapsed(!isSidebarCollapsed)} style={{ marginRight: 15 }}>
            <Ionicons name={isSidebarCollapsed ? "menu-outline" : "close-outline"} size={26} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.collegeName}>GFM Record Management</Text>
            <Text style={styles.tagline}>{teacherName} | {teacherDept} Department</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          {width > 600 && <Text style={styles.logoutText}>Logout</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.mainContent}>
        {/* Sidebar */}
        <View style={[styles.sidebar, isSidebarCollapsed && { width: Platform.OS === 'web' ? 70 : 0 }]}>
          <ScrollView>
            {userRole === 'teacher' && (
              <>
                {!isSidebarCollapsed && <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.textLight, paddingHorizontal: 20, marginVertical: 10, marginTop: 20 }}>GFM TOOLS</Text>}
                <SidebarItem id="batch-info" icon="information-circle-outline" label="My Batch Info" group="GFM" />
                <SidebarItem id="students" icon="people-outline" label="My Students" group="GFM" />
                <SidebarItem id="academic" icon="school-outline" label="Academic Data" group="GFM" />
                <SidebarItem id="fees" icon="card-outline" label="Fee Status" group="GFM" />
                <SidebarItem id="activities" icon="layers-outline" label="Activities" group="GFM" />
                <SidebarItem id="achievements" icon="trophy-outline" label="Achievements" group="GFM" />
                <SidebarItem id="internships" icon="briefcase-outline" label="Internships" group="GFM" />
                <SidebarItem id="analytics" icon="analytics-outline" label="Batch Analytics" group="GFM" />

                {!isSidebarCollapsed && <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.textLight, paddingHorizontal: 20, marginVertical: 10, marginTop: 20 }}>ATTENDANCE</Text>}
                <SidebarItem id="attendance-summary" icon="list-outline" label="Attendance Log" group="Attendance" />
              </>
            )}

            {userRole === 'admin' && (
              <>
                {!isSidebarCollapsed && <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.textLight, paddingHorizontal: 20, marginVertical: 10, marginTop: 20 }}>MONITORING</Text>}
                <SidebarItem id="daily-attendance" icon="calendar-outline" label="Today Status" group="ADMIN" />
                <SidebarItem id="admin-reports" icon="stats-chart-outline" label="Attendance History" group="ADMIN" />

                {!isSidebarCollapsed && <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.textLight, paddingHorizontal: 20, marginVertical: 10, marginTop: 20 }}>REGISTRATION</Text>}
                <SidebarItem id="register-student" icon="person-add-outline" label="Add Students" group="ADMIN" />
                <SidebarItem id="students" icon="people-outline" label="Student Database" group="ADMIN" />

                {!isSidebarCollapsed && <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.textLight, paddingHorizontal: 20, marginVertical: 10, marginTop: 20 }}>ADMIN TOOLS</Text>}
                <SidebarItem id="fees" icon="card-outline" label="Fee Monitoring" group="ADMIN" />
                <SidebarItem id="manage-staff" icon="people-circle-outline" label="Manage Staff" group="ADMIN" />
                <SidebarItem id="courses" icon="book-outline" label="Course Config" group="ADMIN" />
              </>
            )}
          </ScrollView>
        </View>

        {/* Content Area */}
        <View style={styles.contentArea}>
          {currentModule !== 'analytics' && currentModule !== 'attendance' && currentModule !== 'attendance-summary' && currentModule !== 'admin-reports' && currentModule !== 'manage-staff' && currentModule !== 'daily-attendance' && currentModule !== 'register-student' && renderFilters()}

          <ScrollView contentContainerStyle={styles.scrollContent}>
            <ModuleRenderer
              currentModule={currentModule}
              teacherPrn={teacherPrn}
              teacherDept={teacherDept}
              students={students}
              searchQuery={searchQuery}
              gfmFilters={{ dept: gfmDeptFilter, year: gfmYearFilter, div: gfmDivFilter }}
              attFilters={{ dept: attDeptFilter, year: attYearFilter, div: attDivFilter }}
              courses={courses}
              semFilter={semFilter}
              activityTypeFilter={activityTypeFilter}
              onViewStudentDetails={setSelectedStudentForDetails}
              onViewAcademicRecord={setSelectedStudentForAcademicView}
              onPrintStudent={(s: Student) => {
                setStudentForPrint(s);
                setPrintOptionsVisible(true);
              }}
              onQuickEdit={openQuickEdit}
              onRefresh={loadData}
              onViewDocument={handleViewDocument}
              yearsOfStudy={yearsOfStudy}
              batchConfig={batchConfig}
              router={router}
            />
          </ScrollView>
        </View>
      </View>

      {/* Modals */}
      <StudentDetailsModal
        visible={!!selectedStudentForDetails}
        student={selectedStudentForDetails}
        onClose={() => setSelectedStudentForDetails(null)}
        onExportPDF={(student: Student, options: any) => exportStudentPDF(student, options, setLoading)}
        onQuickEdit={openQuickEdit}
      />

      <AcademicViewModal
        visible={!!selectedStudentForAcademicView}
        student={selectedStudentForAcademicView}
        onClose={() => setSelectedStudentForAcademicView(null)}
      />

      <QuickEditModal
        visible={editModalVisible}
        section={editingSection}
        editData={editData}
        isSaving={isSaving}
        onClose={() => setEditModalVisible(false)}
        onSave={handleQuickSave}
        setEditData={setEditData}
      />

      <PrintOptionsModal
        visible={printOptionsVisible}
        student={studentForPrint}
        printOptions={printOptions}
        setPrintOptions={setPrintOptions}
        onClose={() => setPrintOptionsVisible(false)}
        onGenerate={() => {
          if (studentForPrint) {
            exportStudentPDF(studentForPrint, printOptions, setLoading);
            setPrintOptionsVisible(false);
          }
        }}
      />
    </View>
  );
}
