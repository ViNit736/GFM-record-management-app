import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import Papa from 'papaparse';
import React, { useEffect, useRef, useState } from 'react';
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
import { BRANCH_MAPPINGS, getFullBranchName } from '../../constants/Mappings';
import { getSession } from '../../services/session.service';
import { deleteFacultyMember, FacultyMember, getFacultyMembers, saveFacultyMember } from '../../storage/sqlite';

const DEPARTMENTS = Object.keys(BRANCH_MAPPINGS);

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

export default function ManageFaculty() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [faculty, setFaculty] = useState<FacultyMember[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newFaculty, setNewFaculty] = useState({
    prn: '',
    fullName: '',
    email: '',
    department: 'CSE'
  });

  useEffect(() => {
    checkAuth();
    loadFaculty();
  }, []);

  const checkAuth = async () => {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      router.replace('/');
    }
  };

  const loadFaculty = async () => {
    setLoading(true);
    try {
      const data = await getFacultyMembers();
      setFaculty(data);
    } catch (error) {
      console.error('Error loading faculty:', error);
      Alert.alert('Error', 'Failed to load faculty members');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFaculty = async () => {
    if (!newFaculty.prn || !newFaculty.fullName || !newFaculty.email || !newFaculty.department) {
      Alert.alert('Error', 'Please enter Full Name, Email, PRN and Department');
      return;
    }
    try {
      await saveFacultyMember(newFaculty.prn, newFaculty.prn, newFaculty.fullName, newFaculty.department, newFaculty.email);
      setModalVisible(false);
      setNewFaculty({ prn: '', fullName: '', email: '', department: 'CSE' });
      loadFaculty();
      Alert.alert('Success', 'Faculty member added successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to add faculty member');
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
          const parsedFaculty = results.data.map((row: any) => ({
            fullName: row['Full Name'] || row['fullName'] || row['Name'] || row['name'] || '',
            email: row['Email'] || row['email'] || row['Email ID'] || row['EmailID'] || '',
            prn: String(row['PRN'] || row['prn'] || row['ID'] || row['id'] || row['Faculty ID'] || ''),
            department: row['Department'] || row['department'] || row['Dept'] || row['dept'] || 'CSE'
          })).filter((f: any) => f.fullName && f.prn);

          setImportPreview(parsedFaculty);
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

  const handleImportFaculty = async () => {
    if (importPreview.length === 0) {
      Alert.alert('Error', 'No faculty to import');
      return;
    }

    setImporting(true);
    let successCount = 0;
    let failCount = 0;

    for (const fac of importPreview) {
      try {
        await saveFacultyMember(fac.prn, fac.prn, fac.fullName, fac.department, fac.email);
        successCount++;
      } catch (e) {
        failCount++;
      }
    }

    setImporting(false);
    setImportModalVisible(false);
    setImportPreview([]);
    loadFaculty();
    Alert.alert('Import Complete', `Successfully added ${successCount} faculty. ${failCount > 0 ? `${failCount} failed (duplicate PRN).` : ''}`);
  };

  const handleDeleteFaculty = (prn: string) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to remove faculty member ${prn}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFacultyMember(prn);
              loadFaculty();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete faculty member');
            }
          }
        }
      ]
    );
  };

  const renderFacultyItem = ({ item }: { item: FacultyMember }) => (
    <View style={styles.facultyCard}>
      <View style={styles.facultyInfo}>
        <Ionicons name="person-circle-outline" size={40} color={COLORS.primary} />
        <View style={styles.textContainer}>
          <Text style={styles.facultyName}>{item.fullName || item.prn}</Text>
          <Text style={styles.facultyPrn}>PRN: {item.prn}</Text>
          {item.email && <Text style={styles.facultyEmail}>{item.email}</Text>}
          <Text style={styles.facultyDept}>{getFullBranchName(item.department || '') || 'No Department'}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => handleDeleteFaculty(item.prn)} style={styles.deleteBtn}>
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
        <Text style={styles.headerTitle}>Manage Faculty</Text>
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
          data={faculty}
          keyExtractor={(item) => item.prn}
          renderItem={renderFacultyItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No faculty members found. Click + to add or Import from CSV.</Text>
          }
        />
      )}

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Faculty Member</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Faculty Full Name"
              value={newFaculty.fullName}
              onChangeText={t => setNewFaculty({ ...newFaculty, fullName: t })}
            />

            <Text style={styles.label}>Email ID *</Text>
            <TextInput
              style={styles.input}
              placeholder="faculty@email.com"
              value={newFaculty.email}
              onChangeText={t => setNewFaculty({ ...newFaculty, email: t })}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>PRN / Username *</Text>
            <TextInput
              style={styles.input}
              placeholder="PRN / Username"
              value={newFaculty.prn}
              onChangeText={t => setNewFaculty({ ...newFaculty, prn: t })}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>Department *</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={newFaculty.department}
                onValueChange={v => setNewFaculty({ ...newFaculty, department: v })}
                style={styles.picker}
              >
                {DEPARTMENTS.map(d => (
                  <Picker.Item key={d} label={BRANCH_MAPPINGS[d]} value={d} />
                ))}
              </Picker>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={[styles.modalBtn, styles.cancelBtn]}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddFaculty} style={[styles.modalBtn, styles.saveBtn]}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={importModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Import Preview ({importPreview.length} faculty)</Text>
              <TouchableOpacity onPress={() => { setImportModalVisible(false); setImportPreview([]); }}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.helperText}>CSV should have columns: Full Name, Email, PRN, Department</Text>

            <ScrollView style={{ maxHeight: 400 }}>
              <View style={styles.previewTable}>
                <View style={[styles.previewRow, styles.previewHeader]}>
                  <Text style={[styles.previewCell, { flex: 1.2, color: '#fff' }]}>Full Name</Text>
                  <Text style={[styles.previewCell, { flex: 1.2, color: '#fff' }]}>Email</Text>
                  <Text style={[styles.previewCell, { flex: 0.8, color: '#fff' }]}>PRN</Text>
                  <Text style={[styles.previewCell, { flex: 0.8, color: '#fff' }]}>Dept</Text>
                </View>
                {importPreview.map((f, idx) => (
                  <View key={idx} style={styles.previewRow}>
                    <Text style={[styles.previewCell, { flex: 1.2 }]}>{f.fullName}</Text>
                    <Text style={[styles.previewCell, { flex: 1.2 }]}>{f.email}</Text>
                    <Text style={[styles.previewCell, { flex: 0.8 }]}>{f.prn}</Text>
                    <Text style={[styles.previewCell, { flex: 0.8 }]}>{f.department}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => { setImportModalVisible(false); setImportPreview([]); }} style={[styles.modalBtn, styles.cancelBtn]}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleImportFaculty} disabled={importing} style={[styles.modalBtn, styles.saveBtn]}>
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
  facultyCard: {
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
  facultyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  textContainer: {
    marginLeft: 15,
    flex: 1,
  },
  facultyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  facultyPrn: {
    fontSize: 13,
    color: COLORS.secondary,
    marginTop: 2,
  },
  facultyEmail: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
  },
  facultyDept: {
    fontSize: 12,
    color: COLORS.textLight,
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
    marginBottom: 15,
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
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  modalBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
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
  pickerWrapper: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginTop: 5,
  },
  picker: {
    height: 50,
  },
});
