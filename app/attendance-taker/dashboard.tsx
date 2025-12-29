import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { getFullBranchName, getFullYearName } from '../../constants/Mappings';
import { clearSession, getSession } from '../../services/session.service';
import { supabase } from '../../services/supabase';
import {
  AttendanceRecord,
  AttendanceSession,
  createAttendanceSession,
  deleteAttendanceSession,
  getAttendanceRecords,
  getDistinctYearsOfStudy,
  getStudentsByDivision,
  saveAttendanceRecords,
  toCamelCase
} from '../../storage/sqlite';

const isWeb = Platform.OS === 'web';

type ViewMode = 'home' | 'add' | 'history';

export default function AttendanceTakerDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userName, setUserName] = useState('');
  const [lastSubmitted, setLastSubmitted] = useState<{
    session: AttendanceSession;
    absentCount: number;
    totalCount: number;
  } | null>(null);

  // Form state
  const [deptFilter, setDeptFilter] = useState('CSE');
  const [yearFilter, setYearFilter] = useState('');
  const [divFilter, setDivFilter] = useState('A');
  const [absentRollNos, setAbsentRollNos] = useState('');

  // Metadata
  const [yearsOfStudy, setYearsOfStudy] = useState<string[]>([]);
  const [completedDivisions, setCompletedDivisions] = useState<string[]>([]);

  // History state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [historySessions, setHistorySessions] = useState<AttendanceSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null);
  const [sessionRecords, setSessionRecords] = useState<any[]>([]);
  const [sessionAllocations, setSessionAllocations] = useState<any[]>([]);

  // Suggestions state
  const [students, setStudents] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    checkAuth();
    loadMetadata();
  }, []);

  useEffect(() => {
    if (yearFilter && deptFilter && divFilter) {
      checkCompletedDivisions();
      loadStudentsForSuggestions();
    }
  }, [yearFilter, deptFilter, divFilter, viewMode]);

  const loadStudentsForSuggestions = async () => {
    try {
      const { data } = await supabase
        .from('students')
        .select('prn, fullName')
        .eq('branch', deptFilter)
        .eq('year_of_study', yearFilter)
        .eq('division', divFilter)
        .order('prn');
      setStudents(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAbsentTextChange = (text: string) => {
    setAbsentRollNos(text);
    const parts = text.split(/[,\s]+/);
    const lastPart = parts[parts.length - 1].toLowerCase();

    if (lastPart.length > 0) {
      const filtered = students
        .filter(s =>
          s.prn.toLowerCase().includes(lastPart) ||
          s.prn.slice(-3).includes(lastPart)
        )
        .map(s => s.prn.slice(-3)) // Suggest the last 3 digits for consistency
        .slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const applySuggestion = (suggestion: string) => {
    const parts = absentRollNos.split(/[,\s]+/);
    parts[parts.length - 1] = suggestion;
    setAbsentRollNos(parts.join(', ') + ', ');
    setSuggestions([]);
  };

  const checkCompletedDivisions = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('attendance_sessions')
        .select('division')
        .eq('date', today)
        .eq('academic_year', yearFilter)
        .eq('department', deptFilter);

      if (error) throw error;
      const completed = data?.map(d => d.division) || [];
      setCompletedDivisions(completed);

      // If current division is completed, switch to next available one
      const available = ['A', 'B', 'C'].filter(d => !completed.includes(d));
      if (available.length > 0 && completed.includes(divFilter)) {
        setDivFilter(available[0]);
      }
    } catch (e) {
      console.error('Error checking completed divisions:', e);
    }
  };

  const checkAuth = async () => {
    const session = await getSession();
    if (!session || session.role !== 'attendance_taker') {
      router.replace('/');
    } else {
      setUserName(session.fullName || 'Attendance Taker');
      if (session.department) setDeptFilter(session.department);
    }
    setLoading(false);
  };

  const loadMetadata = async () => {
    const allYears = await getDistinctYearsOfStudy();
    setYearsOfStudy(allYears);

    if (allYears.length > 0 && (!yearFilter || !allYears.includes(yearFilter))) {
      // Default to 1st Year if available, else first year in list
      const firstYear = allYears.find(y => y.includes('1st')) || allYears[0];
      setYearFilter(firstYear);
    }
  };

  const handleLogout = async () => {
    await clearSession();
    router.replace('/');
  };

  const getPrnPrefix = () => {
    let yearCode = '24'; // Default
    const y = yearFilter.toLowerCase();
    if (y.includes('1st') || y === 'fe') yearCode = '25';
    else if (y.includes('2nd') || y === 'se') yearCode = '24';
    else if (y.includes('3rd') || y === 'te') yearCode = '23';
    else if (y.includes('4th') || y === 'be') yearCode = '22';

    let deptCode = deptFilter;
    if (deptFilter === 'CSE') deptCode = 'CS';
    else if (deptFilter === 'AIDS') deptCode = 'AD';
    else if (deptFilter === 'AIML') deptCode = 'AI';
    else if (deptFilter === 'ECE') deptCode = 'EC';

    return `RBT${yearCode}${deptCode}`;
  };

  const handleSubmitAttendance = async () => {
    if (!deptFilter || !yearFilter || !divFilter) {
      Alert.alert('Error', 'Please select Dept, Year and Division');
      return;
    }

    setSubmitting(true);
    try {
      const s = await getSession();
      if (!s) return;

      // 1. Fetch students for this division to map roll numbers
      const students = await getStudentsByDivision(deptFilter, yearFilter, divFilter, true);
      if (students.length === 0) {
        Alert.alert('Error', 'No students found for this selection');
        setSubmitting(false);
        return;
      }

      const prefix = getPrnPrefix();

      // 2. Parse absent roll numbers and normalize them
      const absentRolls = absentRollNos
        .split(/[,\s]+/)
        .map(r => r.trim())
        .filter(r => r.length > 0)
        .map(r => {
          // If it's just 1-3 digits, prepend prefix
          if (r.length <= 3) {
            const padded = r.padStart(3, '0');
            return (prefix + padded).toLowerCase();
          }
          return r.toLowerCase();
        });

      // 3. Create session with all required fields
      const newSession = await createAttendanceSession({
        teacherId: s.id,
        date: new Date().toISOString().split('T')[0],
        academicYear: yearFilter,
        department: deptFilter,
        class: yearFilter,
        division: divFilter,
        batchName: `Division ${divFilter}`,
        rbtFrom: students[0]?.prn || prefix + '001',
        rbtTo: students[students.length - 1]?.prn || prefix + '999',
        locked: true
      });

      // 4. Create records
      const records: AttendanceRecord[] = students.map(student => {
        const studentPrnLower = student.prn.toLowerCase();
        const rollNo = student.prn.slice(-3);

        const isAbsent = absentRolls.some(r =>
          r === studentPrnLower ||
          r === rollNo ||
          r === (prefix.toLowerCase() + rollNo)
        );

        return {
          sessionId: newSession.id,
          studentPrn: student.prn,
          status: isAbsent ? 'Absent' : 'Present',
          remark: ''
        };
      });

      await saveAttendanceRecords(records);

      const absentCount = records.filter(r => r.status === 'Absent').length;
      setLastSubmitted({
        session: newSession,
        absentCount,
        totalCount: students.length
      });

      // Refresh completed divisions
      await checkCompletedDivisions();

      Alert.alert('Success', `Attendance recorded: ${students.length - absentCount} Present, ${absentCount} Absent`);
      setAbsentRollNos('');
      // Do not reset viewMode to 'home' to keep year/dept selected
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to record attendance. Please check all fields.');
    } finally {
      setSubmitting(false);
    }
  };

  const loadHistory = async (date: Date) => {
    setLoadingHistory(true);
    try {
      const dateStr = date.toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('date', dateStr)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistorySessions(data?.map(toCamelCase) || []);
      setSelectedSession(null);
      setSessionRecords([]);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const viewSessionDetails = async (session: AttendanceSession) => {
    setSelectedSession(session);
    setLoadingHistory(true);
    try {
      // 1. Fetch records
      const records = await getAttendanceRecords(session.id);
      setSessionRecords(records);

      // 2. Fetch GFM Allocations for this session's context
      const { data: allocs, error } = await supabase
        .from('teacher_batch_configs')
        .select('*, profiles(full_name)')
        .eq('department', session.department)
        .eq('class', session.class)
        .eq('division', session.division)
        .eq('academic_year', session.academicYear);

      if (!error) {
        setSessionAllocations(allocs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    Alert.alert(
      'Delete Record',
      'Are you sure you want to delete this attendance record? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoadingHistory(true);
            try {
              await deleteAttendanceSession(sessionId);
              Alert.alert('Success', 'Record deleted successfully');
              loadHistory(selectedDate);
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'Failed to delete record');
            } finally {
              setLoadingHistory(false);
            }
          }
        }
      ]
    );
  };

  const onDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      loadHistory(date);
    }
  };

  const isSessionDeletable = (createdAt: string) => {
    const createdDate = new Date(createdAt).getTime();
    const now = new Date().getTime();
    const diffHours = (now - createdDate) / (1000 * 60 * 60);
    return diffHours < 24;
  };

  const renderHome = () => (
    <View style={styles.homeContainer}>
      <TouchableOpacity
        style={styles.mainActionBtn}
        onPress={() => setViewMode('add')}
      >
        <View style={[styles.iconCircle, { backgroundColor: COLORS.primary }]}>
          <Ionicons name="add" size={40} color="#fff" />
        </View>
        <Text style={styles.mainActionText}>Add Attendance Record</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.mainActionBtn}
        onPress={() => {
          setViewMode('history');
          loadHistory(selectedDate);
        }}
      >
        <View style={[styles.iconCircle, { backgroundColor: COLORS.secondary }]}>
          <Ionicons name="calendar" size={35} color="#fff" />
        </View>
        <Text style={styles.mainActionText}>View Records History</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAddForm = () => (
    <ScrollView contentContainerStyle={styles.formContent}>
      {lastSubmitted && (
        <View style={styles.lastSubmittedCard}>
          <View style={styles.lastSubmittedHeader}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
            <Text style={styles.lastSubmittedTitle}>Last Submission Success</Text>
          </View>
          <View style={styles.lastSubmittedDetails}>
            <Text style={styles.lastSubmittedText}>
              Class: <Text style={{ fontWeight: 'bold' }}>{getFullBranchName(lastSubmitted.session.department)} {getFullYearName(lastSubmitted.session.class)} ({lastSubmitted.session.division})</Text>
            </Text>
            <Text style={styles.lastSubmittedText}>
              Stats: <Text style={{ color: COLORS.success, fontWeight: 'bold' }}>{lastSubmitted.totalCount - lastSubmitted.absentCount} Present</Text>, {' '}
              <Text style={{ color: COLORS.error, fontWeight: 'bold' }}>{lastSubmitted.absentCount} Absent</Text>
            </Text>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>New Attendance Record</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Department</Text>
          <View style={styles.pickerContainer}>
            <Picker selectedValue={deptFilter} onValueChange={setDeptFilter} style={styles.picker}>
              <Picker.Item label="Computer Engineering" value="CSE" />
              <Picker.Item label="Information Technology" value="IT" />
              <Picker.Item label="Electronics & Communication Engineering" value="ECE" />
              <Picker.Item label="Mechanical Engineering" value="ME" />
              <Picker.Item label="Civil Engineering" value="CE" />
              <Picker.Item label="Electrical Engineering" value="EE" />
              <Picker.Item label="Artificial Intelligence & Data Science" value="AIDS" />
              <Picker.Item label="Artificial Intelligence & Machine Learning" value="AIML" />
            </Picker>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Year</Text>
          <View style={styles.pickerContainer}>
            <Picker selectedValue={yearFilter} onValueChange={setYearFilter} style={styles.picker}>
              {yearsOfStudy.map(year => (
                <Picker.Item key={year} label={getFullYearName(year)} value={year} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Division</Text>
          {completedDivisions.length >= 3 ? (
            <View style={styles.completedBanner}>
              <Ionicons name="checkmark-done-circle" size={20} color={COLORS.success} />
              <Text style={styles.completedText}>All divisions (A, B, C) recorded for today.</Text>
            </View>
          ) : (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={divFilter}
                onValueChange={setDivFilter}
                style={styles.picker}
              >
                {['A', 'B', 'C'].map(div => (
                  <Picker.Item
                    key={div}
                    label={completedDivisions.includes(div) ? `${div} (Already Recorded)` : div}
                    value={div}
                    enabled={!completedDivisions.includes(div)}
                  />
                ))}
              </Picker>
            </View>
          )}
        </View>

        {completedDivisions.length < 3 && (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Absent Roll Numbers</Text>
              <View style={styles.prefixBadge}>
                <Text style={styles.prefixText}>Prefix: {getPrnPrefix()}</Text>
              </View>
              <Text style={styles.helperText}>Enter only last 3 digits (e.g. 101, 105)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 101, 105, 120"
                value={absentRollNos}
                onChangeText={handleAbsentTextChange}
                multiline
                numberOfLines={4}
              />
              {suggestions.length > 0 && (
                <View style={styles.suggestionBox}>
                  {suggestions.map((s, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.suggestionItem}
                      onPress={() => applySuggestion(s)}
                    >
                      <Text style={styles.suggestionText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmitAttendance}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>Submit Record</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => setViewMode('home')}
        >
          <Text style={styles.cancelBtnText}>Back</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderHistory = () => (
    <View style={styles.historyContainer}>
      <View style={styles.dateHeader}>
        <TouchableOpacity
          style={styles.dateSelector}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
          <Text style={styles.dateText}>{selectedDate.toDateString()}</Text>
          <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
        </TouchableOpacity>

        {showDatePicker && (
          isWeb ? (
            <input
              type="date"
              value={selectedDate.toISOString().split('T')[0]}
              onChange={(e) => {
                const date = new Date(e.target.value);
                if (!isNaN(date.getTime())) {
                  onDateChange({}, date);
                }
              }}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                marginTop: '10px'
              }}
            />
          ) : (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={onDateChange}
            />
          )
        )}
      </View>

      {loadingHistory ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
      ) : (
        <ScrollView style={styles.historyScroll}>
          {selectedSession ? (
            <View style={styles.sessionDetails}>
              <TouchableOpacity
                style={styles.backLink}
                onPress={() => setSelectedSession(null)}
              >
                <Ionicons name="arrow-back" size={16} color={COLORS.primary} />
                <Text style={styles.backLinkText}>Back to List</Text>
              </TouchableOpacity>

              <View style={styles.sessionInfoCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sessionInfoTitle}>
                      {getFullBranchName(selectedSession.department)} - {getFullYearName(selectedSession.class)} ({selectedSession.division})
                    </Text>
                    <Text style={styles.sessionInfoTime}>
                      Time: {new Date(selectedSession.createdAt).toLocaleTimeString()}
                    </Text>
                  </View>
                  {isSessionDeletable(selectedSession.createdAt) && (
                    <TouchableOpacity
                      style={styles.deleteIconBtn}
                      onPress={() => handleDeleteSession(selectedSession.id)}
                    >
                      <Ionicons name="trash-outline" size={24} color={COLORS.error} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.recordsTable}>
                <View style={[styles.tableHeader, { backgroundColor: COLORS.secondary + '10', borderTopLeftRadius: 10, borderTopRightRadius: 10 }]}>
                  <Text style={[styles.tableHead, { flex: 1, paddingLeft: 10 }]}>Roll</Text>
                  <Text style={[styles.tableHead, { flex: 3 }]}>Name</Text>
                  <Text style={[styles.tableHead, { flex: 1.5, textAlign: 'center' }]}>Status</Text>
                </View>
                {sessionRecords.map((rec) => (
                  <View key={rec.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { flex: 1, paddingLeft: 10 }]}>{rec.studentPrn.slice(-3)}</Text>
                    <Text style={[styles.tableCell, { flex: 3 }]}>{rec.fullName || rec.studentPrn}</Text>
                    <View style={[
                      styles.statusBadge,
                      rec.status === 'Absent' ? styles.absentBadge : styles.presentBadge
                    ]}>
                      <Text style={[
                        styles.statusText,
                        rec.status === 'Absent' ? styles.absentText : styles.presentText
                      ]}>
                        {rec.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Batch-wise GFM Summary */}
              <View style={[styles.card, { marginTop: 20 }]}>
                <Text style={styles.sectionTitle}>Batch-wise GFM Allotment</Text>
                {sessionAllocations.length === 0 ? (
                  <Text style={styles.helperText}>No GFM allocations found for this division.</Text>
                ) : (
                  sessionAllocations.map((alloc) => {
                    const absenteesInBatch = sessionRecords.filter(r => {
                      if (r.status !== 'Absent') return false;
                      const fromVal = alloc.rbt_from.toUpperCase();
                      const toVal = alloc.rbt_to.toUpperCase();
                      const prnVal = r.studentPrn.toUpperCase();

                      if (!isNaN(Number(fromVal)) && !isNaN(Number(toVal))) {
                        const rollNo = parseInt(r.studentPrn.slice(-3));
                        return rollNo >= parseInt(fromVal) && rollNo <= parseInt(toVal);
                      }
                      return prnVal >= fromVal && prnVal <= toVal;
                    });

                    return (
                      <View key={alloc.id} style={styles.batchSummaryCard}>
                        <View style={styles.batchSummaryHeader}>
                          <View>
                            <Text style={styles.batchName}>{alloc.batch_name}</Text>
                            <Text style={styles.gfmName}>GFM: {alloc.profiles?.full_name || 'Not Assigned'}</Text>
                          </View>
                          <View style={[styles.countBadge, { backgroundColor: absenteesInBatch.length > 0 ? COLORS.error + '15' : COLORS.success + '15' }]}>
                            <Text style={[styles.countText, { color: absenteesInBatch.length > 0 ? COLORS.error : COLORS.success }]}>
                              {absenteesInBatch.length} Absent
                            </Text>
                          </View>
                        </View>
                        {absenteesInBatch.length > 0 && (
                          <View style={styles.absentListInline}>
                            <Text style={styles.absentListTitle}>Absent List:</Text>
                            <Text style={styles.absentListText}>
                              {absenteesInBatch.map(a => a.studentPrn.slice(-3)).join(', ')}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          ) : (
            <View style={styles.sessionList}>
              <Text style={styles.sectionTitle}>Records for this day</Text>
              {historySessions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={50} color="#ddd" />
                  <Text style={styles.emptyStateText}>No records found for this date.</Text>
                </View>
              ) : (
                historySessions.map((session) => (
                  <TouchableOpacity
                    key={session.id}
                    style={styles.sessionItem}
                    onPress={() => viewSessionDetails(session)}
                  >
                    <View style={styles.sessionItemContent}>
                      <Text style={styles.sessionItemTitle}>
                        {getFullBranchName(session.department)} - {getFullYearName(session.class)} ({session.division})
                      </Text>
                      <Text style={styles.sessionItemSub}>
                        Recorded at {new Date(session.createdAt).toLocaleTimeString()}
                      </Text>
                    </View>
                    {isSessionDeletable(session.createdAt) && (
                      <TouchableOpacity
                        style={styles.deleteSmallBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session.id);
                        }}
                      >
                        <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                      </TouchableOpacity>
                    )}
                    <Ionicons name="chevron-forward" size={20} color="#ccc" style={{ marginLeft: 5 }} />
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}

      <TouchableOpacity
        style={styles.bottomBackBtn}
        onPress={() => setViewMode('home')}
      >
        <Text style={styles.bottomBackBtnText}>Back to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Attendance Portal</Text>
          <Text style={styles.userName}>{userName}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 100 }} />
      ) : (
        <>
          {viewMode === 'home' && renderHome()}
          {viewMode === 'add' && renderAddForm()}
          {viewMode === 'history' && renderHistory()}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    backgroundColor: COLORS.secondary,
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  userName: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  logoutBtn: { padding: 8 },

  // Home styles
  homeContainer: { flex: 1, padding: 25, justifyContent: 'center', gap: 20 },
  mainActionBtn: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15
  },
  mainActionText: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, textAlign: 'center' },

  // Form styles
  formContent: { padding: 15 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    elevation: 3,
    marginBottom: 15,
  },
  lastSubmittedCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.success,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  lastSubmittedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  lastSubmittedTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  lastSubmittedDetails: {
    paddingLeft: 28,
  },
  lastSubmittedText: {
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 2,
  },
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginBottom: 20 },
  inputGroup: { marginBottom: 15 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  pickerContainer: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, overflow: 'hidden', backgroundColor: '#fafafa' },
  picker: { height: 50 },
  prefixBadge: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  prefixText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  helperText: { fontSize: 12, color: COLORS.textLight, marginBottom: 5 },
  textInput: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fafafa',
    minHeight: 100,
    textAlignVertical: 'top'
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10
  },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { padding: 15, alignItems: 'center' },
  cancelBtnText: { color: COLORS.textLight, fontWeight: '600' },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '10',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.success + '20',
    gap: 10,
  },
  completedText: {
    color: COLORS.success,
    fontSize: 14,
    fontWeight: '600',
  },

  // History styles
  historyContainer: { flex: 1 },
  dateHeader: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center'
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f4f8',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 10
  },
  dateText: { fontWeight: 'bold', color: COLORS.text },
  historyScroll: { flex: 1, padding: 15 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: 15 },
  sessionItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1
  },
  sessionItemContent: { flex: 1 },
  sessionItemTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  sessionItemSub: { fontSize: 13, color: COLORS.textLight, marginTop: 4 },
  emptyState: { alignItems: 'center', marginTop: 50, opacity: 0.5 },
  emptyStateText: { marginTop: 10, fontSize: 16, color: COLORS.textLight },

  sessionDetails: { flex: 1 },
  backLink: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 5 },
  backLinkText: { color: COLORS.primary, fontWeight: '600' },
  sessionInfoCard: { backgroundColor: COLORS.primary + '10', padding: 15, borderRadius: 12, marginBottom: 20 },
  sessionInfoTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
  sessionInfoTime: { fontSize: 14, color: COLORS.textLight, marginTop: 5 },
  deleteIconBtn: { padding: 5 },
  deleteSmallBtn: { padding: 10, marginRight: 5 },

  recordsTable: { backgroundColor: '#fff', borderRadius: 12, padding: 10, elevation: 2 },
  tableHeader: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  tableHead: { fontWeight: 'bold', color: COLORS.textLight, fontSize: 12 },
  tableRow: { flexDirection: 'row', paddingVertical: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
  tableCell: { fontSize: 14, color: COLORS.text },
  statusBadge: { flex: 1.5, paddingVertical: 4, borderRadius: 6, alignItems: 'center' },
  presentBadge: { backgroundColor: COLORS.success + '15' },
  absentBadge: { backgroundColor: COLORS.error + '15' },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  presentText: { color: COLORS.success },
  absentText: { color: COLORS.error },

  bottomBackBtn: { padding: 20, alignItems: 'center', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  bottomBackBtnText: { color: COLORS.primary, fontWeight: 'bold' },

  // New Styles
  suggestionBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    marginTop: 5,
    maxHeight: 150,
    elevation: 3,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f9f9f9',
  },
  suggestionText: {
    fontSize: 14,
    color: COLORS.text,
  },
  batchSummaryCard: {
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  batchSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  batchName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  gfmName: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  countText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  absentListInline: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  absentListTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  absentListText: {
    fontSize: 13,
    color: COLORS.error,
    marginTop: 2,
    fontWeight: '500',
  },
});
