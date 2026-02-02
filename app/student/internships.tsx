import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { getFullYearName } from '../../constants/Mappings';
import { uploadToCloudinary } from '../../services/cloudinaryservices';
import { getSession } from '../../services/session.service';
import {
  Internship,
  getAcademicYearFromSemester,
  getInternships,
  saveInternship
} from '../../storage/sqlite';

const calculateDuration = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  return Math.max(0, months);
};

export default function InternshipsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const [prn, setPrn] = useState('');
  const [internships, setInternships] = useState<Internship[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form fields
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('');
  const [semester, setSemester] = useState('3');
  const [internshipType, setInternshipType] = useState<'Paid' | 'Unpaid'>('Paid');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [duration, setDuration] = useState(0);
  const [stipend, setStipend] = useState('');
  const [description, setDescription] = useState('');
  const [certificateUri, setCertificateUri] = useState('');
  const [certificateFileInfo, setCertificateFileInfo] = useState<{ name: string, type: string } | null>(null);
  const [certificateModalVisible, setCertificateModalVisible] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      const calculatedDuration = calculateDuration(startDate, endDate);
      setDuration(calculatedDuration);
    }
  }, [startDate, endDate]);

  const loadData = async () => {
    try {
      const session = await getSession();
      if (!session || !session.prn) {
        Alert.alert('Session Error', 'Please login again');
        return;
      }

      const userPrn = session.prn;
      setPrn(userPrn);
      const data = await getInternships(userPrn);
      setInternships(data);
    } catch (error) {
      console.error('Error loading internships:', error);
      Alert.alert('Error', 'Failed to load internships');
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
    if (!companyName.trim()) {
      Alert.alert('Error', 'Please enter company name');
      return false;
    }

    if (!role.trim()) {
      Alert.alert('Error', 'Please enter role/position');
      return false;
    }

    if (!startDate || !endDate) {
      Alert.alert('Error', 'Please enter both start and end dates');
      return false;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      Alert.alert('Error', 'End date must be after start date');
      return false;
    }

    if (internshipType === 'Paid' && !stipend) {
      Alert.alert('Error', 'Please enter stipend amount for paid internship');
      return false;
    }

    return true;
  };

  const saveNewInternship = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      let finalCertificateUri = certificateUri;
      if (certificateUri && (certificateUri.startsWith('file://') || certificateUri.startsWith('blob:') || certificateUri.startsWith('data:'))) {
        const uploadedUrl = await uploadToCloudinary(
          certificateUri,
          certificateFileInfo?.type || 'image/jpeg',
          certificateFileInfo?.name || 'certificate.jpg',
          'internship_gfm_record'
        );

        if (uploadedUrl) {
          finalCertificateUri = uploadedUrl;
        } else {
          Alert.alert('Upload Failed', 'Failed to upload certificate to cloud. Please try again.');
          setLoading(false);
          return;
        }
      }

      const internship: Internship = {
        prn,
        semester: parseInt(semester),
        companyName: companyName.trim(),
        role: role.trim(),
        internshipType,
        startDate,
        endDate,
        duration,
        stipend: internshipType === 'Paid' ? parseFloat(stipend) : undefined,
        description: description.trim(),
        certificateUri: finalCertificateUri,
        academicYear: getAcademicYearFromSemester(parseInt(semester))
      };

      await saveInternship(internship);

      Alert.alert('Success', 'Internship added successfully!');
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving internship:', error);
      Alert.alert('Error', 'Failed to save internship');
    } finally {
      setLoading(false);
    }
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

  const resetForm = () => {
    setShowForm(false);
    setCompanyName('');
    setRole('');
    setInternshipType('Paid');
    setStartDate('');
    setEndDate('');
    setDuration(0);
    setStipend('');
    setDescription('');
    setCertificateUri('');
  };


  const styles = createStyles(width, isLargeScreen);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading internships...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Internships</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowForm(!showForm)}
          >
            <Ionicons name={showForm ? 'close' : 'add'} size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={isLargeScreen ? { maxWidth: 1000, alignSelf: 'center', width: '100%' } : undefined}>
        {showForm && (
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Ionicons name="briefcase-outline" size={24} color={COLORS.primary} />
              <Text style={styles.formTitle}>Add Internship</Text>
            </View>

            <View style={styles.formGrid}>
              <View style={[styles.formField, { flex: 1 }]}>
                <Text style={styles.label}>Company Name *</Text>
                <TextInput
                  style={styles.input}
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="e.g., Google"
                />
              </View>
              <View style={[styles.formField, { flex: 1 }]}>
                <Text style={styles.label}>Role / Position *</Text>
                <TextInput
                  style={styles.input}
                  value={role}
                  onChangeText={setRole}
                  placeholder="e.g., Developer Intern"
                />
              </View>
            </View>

            <View style={styles.formGrid}>
              <View style={[styles.formField, { flex: 1 }]}>
                <Text style={styles.label}>Semester *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={semester}
                    onValueChange={(val) => setSemester(val)}
                    style={styles.picker}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                      <Picker.Item key={s} label={`Sem ${s}`} value={s.toString()} />
                    ))}
                  </Picker>
                </View>
              </View>
              <View style={[styles.formField, { flex: 1 }]}>
                <Text style={styles.label}>Type *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={internshipType}
                    onValueChange={(val) => setInternshipType(val as any)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Paid" value="Paid" />
                    <Picker.Item label="Unpaid" value="Unpaid" />
                  </Picker>
                </View>
              </View>
            </View>

            <View style={styles.formGrid}>
              <View style={[styles.formField, { flex: 1 }]}>
                <Text style={styles.label}>Start Date *</Text>
                <TextInput
                  style={styles.input}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>
              <View style={[styles.formField, { flex: 1 }]}>
                <Text style={styles.label}>End Date *</Text>
                <TextInput
                  style={styles.input}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            </View>

            {internshipType === 'Paid' && (
              <View style={styles.formField}>
                <Text style={styles.label}>Monthly Stipend (₹) *</Text>
                <TextInput
                  style={styles.input}
                  value={stipend}
                  onChangeText={setStipend}
                  keyboardType="numeric"
                  placeholder="Enter stipend amount"
                />
              </View>
            )}

            <View style={styles.formField}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Responsibilities and learnings"
                multiline
                numberOfLines={4}
              />
            </View>

            <TouchableOpacity style={styles.uploadButton} onPress={pickCertificate}>
              <Ionicons name={certificateUri ? "checkmark-circle" : "cloud-upload-outline"} size={20} color={certificateUri ? COLORS.success : COLORS.primary} />
              <Text style={[styles.uploadText, certificateUri && { color: COLORS.success }]}>
                {certificateUri ? 'Certificate Attached' : 'Upload Certificate'}
              </Text>
            </TouchableOpacity>

            {!!certificateUri && (
              <TouchableOpacity
                style={styles.previewButton}
                onPress={() => {
                  setSelectedCertificate(certificateUri);
                  setCertificateModalVisible(true);
                }}
              >
                <Ionicons name="eye-outline" size={20} color={COLORS.primary} />
                <Text style={styles.previewText}>Preview Certificate</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.submitButton} onPress={saveNewInternship}>
              <Text style={styles.submitText}>Add Internship</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <Ionicons name="briefcase-outline" size={22} color={COLORS.primary} />
            <Text style={styles.historyTitle}>Your Internships</Text>
          </View>

          {internships.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="briefcase-outline" size={48} color={COLORS.textLight} />
              </View>
              <Text style={styles.emptyText}>No internships added yet</Text>
              <TouchableOpacity style={styles.emptyAddButton} onPress={() => setShowForm(true)}>
                <Text style={styles.emptyAddText}>Add your first internship</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {internships.map((item, index) => (
                <View key={index} style={styles.internshipCard}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.companyNameText}>{item.companyName}</Text>
                      <Text style={styles.roleText}>{item.role}</Text>
                    </View>
                    <View style={styles.badges}>
                      <View style={[styles.statusBadge, item.verificationStatus === 'Verified' ? styles.verifiedBadge : styles.pendingBadge]}>
                        <Text style={[styles.statusBadgeText, item.verificationStatus === 'Verified' ? styles.verifiedText : styles.pendingText]}>
                          {item.verificationStatus || 'Pending'}
                        </Text>
                      </View>
                      <View style={[styles.typeBadge, item.internshipType === 'Paid' ? styles.paidBadge : styles.unpaidBadge]}>
                        <Text style={styles.typeBadgeText}>{item.internshipType}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.internshipMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name="calendar-outline" size={14} color={COLORS.textLight} />
                      <Text style={styles.metaText}>{item.startDate} - {item.endDate}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="time-outline" size={14} color={COLORS.textLight} />
                      <Text style={styles.metaText}>{item.duration} Months</Text>
                    </View>
                    {item.stipend ? (
                      <View style={styles.metaItem}>
                        <Ionicons name="cash-outline" size={14} color={COLORS.success} />
                        <Text style={[styles.metaText, { color: COLORS.success, fontWeight: 'bold' }]}>₹{item.stipend}/mo</Text>
                      </View>
                    ) : null}
                  </View>

                  {item.description ? (
                    <Text style={styles.internshipDesc} numberOfLines={3}>{item.description}</Text>
                  ) : null}

                  <View style={styles.cardFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={styles.semesterTag}>
                        Sem {item.semester} • {getFullYearName(item.academicYear || '')}
                      </Text>
                    </View>
                    {!!item.certificateUri && (
                      <TouchableOpacity
                        style={styles.viewCert}
                        onPress={() => handleViewCertificate(item.certificateUri!)}
                      >
                        <Ionicons name="eye-outline" size={18} color="#2196F3" />
                        <Text style={styles.viewCertText}>View Certificate</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={certificateModalVisible} transparent={true} onRequestClose={() => setCertificateModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Internship Certificate</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setCertificateModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.imageContainer}>
              <Image source={{ uri: selectedCertificate }} style={styles.fullImage} resizeMode="contain" />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (width: number, isLargeScreen: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: 12, color: COLORS.textSecondary, fontSize: 16 },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.white },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  content: { flex: 1, padding: 20, marginTop: -25 },
  formCard: {
    backgroundColor: COLORS.white,
    padding: 24,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 5
  },
  formHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 10 },
  formTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  formGrid: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  formField: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.white
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  pickerContainer: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.white
  },
  picker: { height: 50 },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    backgroundColor: `${COLORS.primary}05`,
    marginBottom: 20
  },
  uploadText: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20
  },
  previewText: { marginLeft: 8, color: COLORS.primary, fontWeight: '600', fontSize: 15 },
  submitButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  submitText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
  historyCard: {
    backgroundColor: COLORS.white,
    padding: 24,
    borderRadius: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3
  },
  historyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 },
  historyTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  emptyText: { fontSize: 16, color: COLORS.textLight, marginBottom: 20 },
  emptyAddButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: `${COLORS.primary}10`
  },
  emptyAddText: { color: COLORS.primary, fontWeight: '600' },
  listContainer: { gap: 16 },
  internshipCard: {
    backgroundColor: COLORS.background,
    padding: 18,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  companyNameText: { fontSize: 17, fontWeight: 'bold', color: COLORS.text, marginBottom: 4 },
  roleText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  badges: { alignItems: 'flex-end', gap: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  verifiedBadge: { backgroundColor: `${COLORS.success}15` },
  verifiedText: { color: COLORS.success },
  pendingBadge: { backgroundColor: `${COLORS.warning}15` },
  pendingText: { color: COLORS.warning },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  paidBadge: { backgroundColor: `${COLORS.success}15` },
  unpaidBadge: { backgroundColor: `${COLORS.textLight}15` },
  typeBadgeText: { fontSize: 10, fontWeight: 'bold', color: COLORS.textSecondary },
  internshipMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: COLORS.textSecondary },
  internshipDesc: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 16 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  semesterTag: { fontSize: 12, color: COLORS.primary, fontWeight: 'bold', backgroundColor: `${COLORS.primary}10`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  viewCert: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${COLORS.primary}10`, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  viewCertText: { color: COLORS.primary, fontSize: 13, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 600, maxHeight: '80%', backgroundColor: COLORS.white, borderRadius: 24, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  closeButton: { padding: 4 },
  imageContainer: { padding: 20, alignItems: 'center', justifyContent: 'center', minHeight: 300 },
  fullImage: { width: '100%', height: 400 },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: `${COLORS.error}10`,
  }
});
