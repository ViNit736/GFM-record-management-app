import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { getFullYearName } from '../../constants/Mappings';
import { uploadToCloudinary } from '../../services/cloudinaryservices';
import { getSession } from '../../services/session.service';
import {
  StudentActivity,
  getAcademicYearFromSemester,
  getStudentActivities,
  saveStudentActivity
} from '../../storage/sqlite';

export default function CoCurricularScreen() {
  const [prn, setPrn] = useState('');
  const [activities, setActivities] = useState<StudentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form fields
  const [activityName, setActivityName] = useState('');
  const [semester, setSemester] = useState(1);
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [certificateUri, setCertificateUri] = useState('');
  const [certificateFileInfo, setCertificateFileInfo] = useState<{ name: string, type: string } | null>(null);

  const [certificateModalVisible, setCertificateModalVisible] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState('');

  const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const session = await getSession();
      if (!session || !session.prn) {
        Alert.alert('Session Error', 'Please login again');
        return;
      }

      const userPrn = session.prn;
      setPrn(userPrn);

      // FETCH FROM SUPABASE (Source of Truth)
      const data = await getStudentActivities(userPrn);

      // Filter for Co-curricular
      setActivities(data.filter(a => a.type === 'Co-curricular'));
    } catch (error) {
      console.error('Error loading activities:', error);
      Alert.alert('Error', 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const pickCertificate = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true
      });

      if (result.assets && result.assets[0]) {
        const file = result.assets[0];
        if (file.size && file.size > 5 * 1024 * 1024) {
          Alert.alert('Error', 'File size must be less than 5MB');
          return;
        }

        setCertificateUri(file.uri);
        setCertificateFileInfo({
          name: file.name || 'certificate.jpg',
          type: file.mimeType || 'image/jpeg'
        });
        Alert.alert('Success', 'Certificate attached');
      }
    } catch (error) {
      console.error('Error picking certificate:', error);
      Alert.alert('Error', 'Failed to upload certificate');
    }
  };

  const validateForm = (): boolean => {
    if (!activityName.trim()) {
      Alert.alert('Error', 'Please enter activity name');
      return false;
    }
    if (!activityDate.trim()) {
      Alert.alert('Error', 'Please enter activity date');
      return false;
    }
    // Simple date format validation YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(activityDate)) {
      Alert.alert('Error', 'Please enter date in YYYY-MM-DD format');
      return false;
    }
    return true;
  };

  const handleViewCertificate = (uri: string) => {
    if (!uri) return;
    const isPdf = uri.toLowerCase().endsWith('.pdf') || uri.includes('/raw/upload/');
    if (isPdf) {
      Linking.openURL(uri).catch(err => {
        console.error("Error opening PDF:", err);
        Alert.alert("Error", "Could not open PDF. Please try again.");
      });
    } else {
      setSelectedCertificate(uri);
      setCertificateModalVisible(true);
    }
  };

  const saveActivity = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const academicYear = getAcademicYearFromSemester(semester);
      let finalCertificateUri = certificateUri;

      if (certificateUri && (certificateUri.startsWith('file://') || certificateUri.startsWith('blob:') || certificateUri.startsWith('data:'))) {
        const uploadedUrl = await uploadToCloudinary(
          certificateUri,
          certificateFileInfo?.type || 'image/jpeg',
          certificateFileInfo?.name || 'certificate.jpg',
          'activities_gfm'
        );

        if (uploadedUrl) {
          finalCertificateUri = uploadedUrl;
        } else {
          Alert.alert('Upload Failed', 'Failed to upload certificate. Please try again.');
          setLoading(false);
          return;
        }
      }

      const activity: StudentActivity = {
        prn,
        semester,
        academicYear,
        activityName: activityName.trim(),
        type: 'Co-curricular',
        activityDate,
        description: description.trim(),
        certificateUri: finalCertificateUri
      };

      // 1. INSERT INTO SUPABASE
      await saveStudentActivity(activity);

      Alert.alert('Success', 'Activity added successfully!');

      // 2. RESET FORM
      resetForm();

      // 3. RE-FETCH FROM SUPABASE (Ensure UI matches database)
      await loadData();
    } catch (error) {
      console.error('Error saving activity:', error);
      Alert.alert('Error', 'Failed to save activity');
    } finally {
      setLoading(false);
    }
  };


  const resetForm = () => {
    setShowForm(false);
    setActivityName('');
    setSemester(1);
    setActivityDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setCertificateUri('');
    setCertificateFileInfo(null);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3F51B5" />
        <Text style={styles.loadingText}>Loading activities...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Co-Curricular Activities</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowForm(!showForm)}
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Add Activity</Text>
            <Text style={styles.formSubtitle}>Workshops, Seminars, Technical Events, etc.</Text>

            <Text style={styles.label}>Activity Name *</Text>
            <TextInput
              style={styles.input}
              value={activityName}
              onChangeText={setActivityName}
              placeholder="e.g., Python Workshop, Robotics Seminar"
            />

            <Text style={styles.label}>Semester *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={semester}
                onValueChange={(val) => setSemester(val)}
              >
                {semesters.map(s => (
                  <Picker.Item key={s} label={`Semester ${s}`} value={s} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Date * (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={activityDate}
              onChangeText={setActivityDate}
              placeholder="YYYY-MM-DD"
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Brief description of the activity"
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity style={styles.uploadButton} onPress={pickCertificate}>
              <Ionicons name="cloud-upload-outline" size={24} color="#3F51B5" />
              <Text style={styles.uploadText}>
                {certificateUri ? 'Certificate Selected' : 'Upload Certificate'}
              </Text>
            </TouchableOpacity>

            {!!certificateUri && (
              <TouchableOpacity
                style={styles.previewButton}
                onPress={() => handleViewCertificate(certificateUri)}
              >
                <Ionicons name="eye-outline" size={20} color="#3F51B5" />
                <Text style={styles.previewText}>Preview Certificate</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.submitButton} onPress={saveActivity}>
              <Text style={styles.submitText}>Save Activity</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.listContainer}>
          {activities.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📑</Text>
              <Text style={styles.emptyText}>No co-curricular activities added yet</Text>
            </View>
          ) : (
            activities.map((item, index) => (
              <View key={index} style={styles.activityCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityTitle}>{item.activityName}</Text>
                    <Text style={styles.activityCategory}>Sem {item.semester} • {getFullYearName(item.academicYear || '')} • {item.activityDate}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={[styles.statusBadge, item.verificationStatus === 'Verified' ? styles.verifiedBadge : styles.pendingBadge]}>
                      <Text style={styles.statusBadgeText}>{item.verificationStatus || 'Pending'}</Text>
                    </View>
                  </View>
                </View>
                {!!item.description && (
                  <Text style={styles.activityDescription}>{item.description}</Text>
                )}
                {!!item.certificateUri && (
                  <TouchableOpacity
                    style={styles.viewCertificate}
                    onPress={() => handleViewCertificate(item.certificateUri!)}
                  >
                    <Ionicons name="eye-outline" size={18} color="#3F51B5" />
                    <Text style={styles.viewCertificateText}>View Certificate</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={certificateModalVisible} transparent={true} onRequestClose={() => setCertificateModalVisible(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setCertificateModalVisible(false)}
          >
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          <Image
            source={{ uri: selectedCertificate }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: {
    backgroundColor: '#3F51B5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  addButton: { padding: 5 },
  content: { flex: 1, padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#666' },
  formCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  formTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  formSubtitle: { fontSize: 13, color: '#666', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  textArea: {
    height: 80,
    textAlignVertical: 'top'
  },
  pickerContainer: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden', marginTop: 4 },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3F51B5',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    marginTop: 20
  },
  uploadText: { marginLeft: 10, color: '#3F51B5', fontWeight: 'bold' },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8EAF6',
    borderRadius: 8,
    padding: 12,
    marginTop: 12
  },
  previewText: { marginLeft: 8, color: '#3F51B5', fontWeight: '600', fontSize: 14 },
  submitButton: {
    backgroundColor: '#3F51B5',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  listContainer: { paddingBottom: 40 },
  activityCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  activityTitle: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  activityCategory: { fontSize: 13, color: '#666', marginTop: 2 },
  activityDescription: { fontSize: 14, color: '#555', marginTop: 8, lineHeight: 20 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  verifiedBadge: { backgroundColor: '#E8F5E9' },
  pendingBadge: { backgroundColor: '#FFF3E0' },
  statusBadgeText: { fontSize: 11, fontWeight: 'bold' },
  viewCertificate: { flexDirection: 'row', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10 },
  viewCertificateText: { marginLeft: 6, color: '#3F51B5', fontWeight: '600' },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyEmoji: { fontSize: 60, marginBottom: 10 },
  emptyText: { color: '#999', fontSize: 16 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalClose: { position: 'absolute', top: 50, right: 20, zIndex: 1 },
  fullImage: { width: '100%', height: '80%' },
  deleteButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#ffebee',
  }
});
