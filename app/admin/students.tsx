import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker'; // Added missing Picker import
import { useRouter } from 'expo-router';
import Papa from 'papaparse';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { DISPLAY_BRANCHES, DISPLAY_YEARS, getFullBranchName, getFullYearName } from '../../constants/Mappings';
import { getSession } from '../../services/session.service';
import { deleteStudent, getAllStudents, getDistinctYearsOfStudy, saveStudent, Student } from '../../storage/sqlite';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

export default function ManageStudents() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newStudent, setNewStudent] = useState({
    prn: '',
    fullName: '',
    email: '',
    branch: 'Computer Engineering',
    yearOfStudy: 'First Year',
    division: 'A'
  });

  const [yearsOfStudy, setYearsOfStudy] = useState<string[]>([]);

  useEffect(() => {
    checkAuth();
    loadData();
    loadMetadata();
  }, []);

  const loadMetadata = async () => {
    const years = await getDistinctYearsOfStudy();
    setYearsOfStudy(years);
  };

  const checkAuth = async () => {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      router.replace('/');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const studentData = await getAllStudents();
      setStudents(studentData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async () => {
    if (!newStudent.prn || !newStudent.fullName || !newStudent.email) {
      Alert.alert('Error', 'Please enter PRN, Full Name and Email');
      return;
    }
    try {
      await saveStudent({
        ...newStudent,
        gfmId: '',
        gfmName: ''
      });
      setModalVisible(false);
      setNewStudent({
        prn: '',
        fullName: '',
        email: '',
        branch: 'Computer Engineering',
        yearOfStudy: 'First Year',
        division: 'A'
      });
      loadData();
      Alert.alert('Success', 'Student added successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to add student. Ensure PRN is unique.');
    }
  };

  const handleFileSelect = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsedStudents = results.data.map((row: any) => ({
            fullName: row['Full Name'] || row['fullName'] || row['Name'] || row['name'] || '',
            email: row['Email'] || row['email'] || row['Email ID'] || row['EmailID'] || '',
            prn: String(row['PRN'] || row['prn'] || row['Roll No'] || row['rollno'] || row['RollNo'] || ''),
            branch: row['Branch'] || row['branch'] || row['Department'] || row['department'] || 'Computer Engineering',
            yearOfStudy: row['Year'] || row['year'] || row['Year of Study'] || row['yearOfStudy'] || 'First Year',
            division: row['Division'] || row['division'] || row['Div'] || row['div'] || 'A'
          })).filter((s: any) => s.fullName && s.prn);

          setImportPreview(parsedStudents);
          setImportModalVisible(true);
          setImporting(false);
        },
        error: () => {
          Alert.alert('Error', 'Failed to read CSV file');
          setImporting(false);
        }
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to read CSV file');
      setImporting(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportStudents = async () => {
    if (importPreview.length === 0) {
      Alert.alert('Error', 'No students to import');
      return;
    }

    setImporting(true);
    let successCount = 0;
    let failCount = 0;

    for (const student of importPreview) {
      try {
        await saveStudent({
          ...student,
          gfmId: '',
          gfmName: ''
        });
        successCount++;
      } catch (e) {
        failCount++;
      }
    }

    setImporting(false);
    setImportModalVisible(false);
    setImportPreview([]);
    loadData();
    Alert.alert('Import Complete', `Successfully added ${successCount} students. ${failCount > 0 ? `${failCount} failed (duplicate PRN).` : ''}`);
  };

  const handleDeleteStudent = (prn: string) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to remove student ${prn}? This will also remove their login profile.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deleteStudent(prn);
              loadData();
              Alert.alert('Success', 'Student removed successfully');
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete student: ' + (error.message || JSON.stringify(error)));
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const renderStudentItem = ({ item }: { item: Student }) => (
    <View style={styles.studentCard}>
      <View style={styles.studentInfo}>
        <Ionicons name="person-circle-outline" size={40} color={COLORS.primary} />
        <View style={styles.textContainer}>
          <Text style={styles.studentName}>{item.fullName}</Text>
          <Text style={styles.studentPrn}>PRN: {item.prn}</Text>
          <Text style={styles.studentDetails}>{getFullBranchName(item.branch)} | {getFullYearName(item.yearOfStudy)} | Div {item.division}</Text>
          {item.email && <Text style={styles.studentEmail}>{item.email}</Text>}
        </View>
      </View>
      <TouchableOpacity onPress={() => handleDeleteStudent(item.prn)} style={styles.deleteBtn}>
        <Ionicons name="trash-outline" size={20} color={COLORS.error} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Students</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {isWeb && (
            <TouchableOpacity onPress={() => fileInputRef.current?.click()} style={styles.importBtn}>
              <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
              <Text style={styles.importBtnText}>Import CSV</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtn}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {isWeb && (
        <input
          type="file"
          ref={fileInputRef as any}
          accept=".csv"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      )}

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.prn}
          renderItem={renderStudentItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No students found. Click + to add a student or Import from CSV.</Text>
          }
        />
      )}

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Student</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Student's Full Name"
                value={newStudent.fullName}
                onChangeText={t => setNewStudent({ ...newStudent, fullName: t })}
              />

              <Text style={styles.label}>Email ID *</Text>
              <TextInput
                style={styles.input}
                placeholder="student@email.com"
                value={newStudent.email}
                onChangeText={t => setNewStudent({ ...newStudent, email: t })}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>PRN *</Text>
              <TextInput
                style={styles.input}
                placeholder="Unique PRN Number"
                value={newStudent.prn}
                onChangeText={t => setNewStudent({ ...newStudent, prn: t })}
                autoCapitalize="characters"
              />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Branch</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={newStudent.branch}
                      onValueChange={v => setNewStudent({ ...newStudent, branch: v })}
                    >
                      {DISPLAY_BRANCHES.map(b => (
                        <Picker.Item key={b.value} label={b.label} value={b.value} />
                      ))}
                    </Picker>
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.label}>Year</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={newStudent.yearOfStudy}
                      onValueChange={v => setNewStudent({ ...newStudent, yearOfStudy: v })}
                    >
                      {DISPLAY_YEARS.map(y => (
                        <Picker.Item key={y.value} label={y.label} value={y.value} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>

              <Text style={styles.label}>Division</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={newStudent.division}
                  onValueChange={v => setNewStudent({ ...newStudent, division: v })}
                >
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
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={[styles.modalBtn, styles.cancelBtn]}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddStudent} style={[styles.modalBtn, styles.saveBtn]}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Add Student</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={importModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Import Preview ({importPreview.length} students)</Text>
              <TouchableOpacity onPress={() => { setImportModalVisible(false); setImportPreview([]); }}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.helperText}>CSV should have columns: Full Name, Email, PRN</Text>

            <ScrollView style={{ maxHeight: 400 }}>
              <View style={styles.previewTable}>
                <View style={[styles.previewRow, styles.previewHeader]}>
                  <Text style={[styles.previewCell, { flex: 1.5, color: '#fff' }]}>Full Name</Text>
                  <Text style={[styles.previewCell, { flex: 1.5, color: '#fff' }]}>Email</Text>
                  <Text style={[styles.previewCell, { flex: 1, color: '#fff' }]}>PRN</Text>
                </View>
                {importPreview.map((s, idx) => (
                  <View key={idx} style={styles.previewRow}>
                    <Text style={[styles.previewCell, { flex: 1.5 }]}>{s.fullName}</Text>
                    <Text style={[styles.previewCell, { flex: 1.5 }]}>{s.email}</Text>
                    <Text style={[styles.previewCell, { flex: 1 }]}>{s.prn}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => { setImportModalVisible(false); setImportPreview([]); }} style={[styles.modalBtn, styles.cancelBtn]}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleImportStudents} disabled={importing} style={[styles.modalBtn, styles.saveBtn]}>
                {importing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>Import All</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  backBtn: {
    padding: 5,
  },
  addBtn: {
    padding: 5,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 5,
  },
  importBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  loader: {
    marginTop: 50,
  },
  listContent: {
    padding: 20,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  textContainer: {
    marginLeft: 15,
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  studentPrn: {
    fontSize: 13,
    color: COLORS.secondary,
    marginTop: 2,
  },
  studentDetails: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  studentEmail: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 10,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: COLORS.textLight,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 5,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginTop: 5,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  modalBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelBtn: {
    backgroundColor: '#eee',
  },
  saveBtn: {
    backgroundColor: COLORS.secondary,
  },
  modalBtnText: {
    fontWeight: 'bold',
    color: COLORS.text,
  },
  helperText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 15,
  },
  previewTable: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  previewHeader: {
    backgroundColor: COLORS.primary,
  },
  previewCell: {
    padding: 10,
    fontSize: 12,
    color: COLORS.text,
  },
});
