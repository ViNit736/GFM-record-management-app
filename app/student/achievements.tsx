import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { uploadToCloudinary } from '../../services/cloudinaryservices';
import { getSession } from '../../services/session.service';
import {
  Achievement,
  getAchievements,
  saveAchievement
} from '../../storage/sqlite';

const getAcademicYearFromSemester = (sem: number): string => {
  if (sem <= 2) return 'FE';
  if (sem <= 4) return 'SE';
  if (sem <= 6) return 'TE';
  return 'BE';
};

export default function AchievementsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const [prn, setPrn] = useState('');
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form fields
  const [achievementName, setAchievementName] = useState('');
  const [semester, setSemester] = useState(1);
  const [type, setType] = useState('Technical');
  const [achievementDate, setAchievementDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [certificateUri, setCertificateUri] = useState('');
  const [certificateFileInfo, setCertificateFileInfo] = useState<{ name: string, type: string } | null>(null);

  const [certificateModalVisible, setCertificateModalVisible] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState('');

  const semesters = [1, 2, 3, 4, 5, 6, 7, 8];
  const types = ['Technical', 'Non-Technical', 'Sports', 'Cultural', 'Academic', 'Other'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const session = await getSession();
      if (!session || !session.prn) {
        Alert.alert('Session Error', 'Please login again');
        return;
      }

      const userPrn = session.prn;
      setPrn(userPrn);
      const data = await getAchievements(userPrn);
      setAchievements(data);
    } catch (error) {
      console.error('Error loading achievements:', error);
      Alert.alert('Error', 'Failed to load achievements');
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

  const pickCertificate = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true
      });

      if (result.assets && result.assets[0]) {
        const file = result.assets[0];

        if (file.size && file.size > 2 * 1024 * 1024) {
          Alert.alert('Error', 'File size must be less than 2MB');
          return;
        }

        setCertificateUri(file.uri);
        setCertificateFileInfo({
          name: file.name || 'certificate.jpg',
          type: file.mimeType || 'image/jpeg'
        });
        Alert.alert('Success', 'Certificate selected');
      }
    } catch (error) {
      console.error('Error picking certificate:', error);
      Alert.alert('Error', 'Failed to pick certificate');
    }
  };

  const validateForm = (): boolean => {
    if (!achievementName.trim()) {
      Alert.alert('Error', 'Please enter achievement name');
      return false;
    }
    if (!achievementDate) {
      Alert.alert('Error', 'Please enter achievement date');
      return false;
    }
    return true;
  };

  const saveNewAchievement = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      let finalCertificateUri = certificateUri;
      if (certificateUri && (certificateUri.startsWith('file://') || certificateUri.startsWith('blob:') || certificateUri.startsWith('data:'))) {
        const uploadedUrl = await uploadToCloudinary(
          certificateUri,
          certificateFileInfo?.type || 'image/jpeg',
          certificateFileInfo?.name || 'certificate.jpg',
          'achievements_gfm'
        );

        if (uploadedUrl) {
          finalCertificateUri = uploadedUrl;
        } else {
          Alert.alert('Upload Failed', 'Failed to upload certificate. Please try again.');
          setLoading(false);
          return;
        }
      }

      const academicYear = getAcademicYearFromSemester(semester);
      const achievement: Achievement = {
        prn,
        semester,
        academicYear,
        achievementName: achievementName.trim(),
        type,
        achievementDate,
        description: description.trim(),
        certificateUri: finalCertificateUri
      };

      await saveAchievement(achievement);

      Alert.alert('Success', 'Achievement added successfully!');
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving achievement:', error);
      Alert.alert('Error', 'Failed to save achievement');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setAchievementName('');
    setSemester(1);
    setType('Technical');
    setAchievementDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setCertificateUri('');
    setCertificateFileInfo(null);
  };

  const styles = createStyles(width, isLargeScreen);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading achievements...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Achievements</Text>
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
              <Ionicons name="ribbon-outline" size={24} color={COLORS.primary} />
              <Text style={styles.formTitle}>Add Achievement</Text>
            </View>

            <View style={styles.formGrid}>
              <View style={[styles.formField, { flex: 2 }]}>
                <Text style={styles.label}>Achievement Name *</Text>
                <TextInput
                  style={styles.input}
                  value={achievementName}
                  onChangeText={setAchievementName}
                  placeholder="e.g., 1st Prize in Hackathon"
                />
              </View>

              <View style={[styles.formField, { flex: 1 }]}>
                <Text style={styles.label}>Semester *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={semester}
                    onValueChange={(val) => setSemester(val)}
                    style={styles.picker}
                  >
                    {semesters.map(s => (
                      <Picker.Item key={s} label={`Sem ${s}`} value={s} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>

            <View style={styles.formGrid}>
              <View style={[styles.formField, { flex: 1 }]}>
                <Text style={styles.label}>Type *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={type}
                    onValueChange={(val) => setType(val)}
                    style={styles.picker}
                  >
                    {types.map(t => (
                      <Picker.Item key={t} label={t} value={t} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={[styles.formField, { flex: 1 }]}>
                <Text style={styles.label}>Date *</Text>
                <TextInput
                  style={styles.input}
                  value={achievementDate}
                  onChangeText={setAchievementDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Brief description of the achievement"
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity style={styles.uploadButton} onPress={pickCertificate}>
              <Ionicons name={certificateUri ? "checkmark-circle" : "cloud-upload-outline"} size={20} color={certificateUri ? COLORS.success : COLORS.primary} />
              <Text style={[styles.uploadText, certificateUri && { color: COLORS.success }]}>
                {certificateUri ? 'Certificate Selected' : 'Upload Certificate'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitButton} onPress={saveNewAchievement}>
              <Text style={styles.submitText}>Save Achievement</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <Ionicons name="medal-outline" size={22} color={COLORS.primary} />
            <Text style={styles.historyTitle}>Your Achievements</Text>
          </View>

          {achievements.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="ribbon-outline" size={48} color={COLORS.textLight} />
              </View>
              <Text style={styles.emptyText}>No achievements added yet</Text>
              <TouchableOpacity style={styles.emptyAddButton} onPress={() => setShowForm(true)}>
                <Text style={styles.emptyAddText}>Add your first achievement</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {achievements.map((item, index) => (
                <View key={index} style={styles.achievementCard}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.achievementTitle}>{item.achievementName}</Text>
                      <View style={styles.achievementMeta}>
                        <View style={styles.typeTag}>
                          <Text style={styles.typeTagText}>{item.type}</Text>
                        </View>
                        <Text style={styles.metaText}>Sem {item.semester}</Text>
                        <View style={styles.dot} />
                        <Text style={styles.metaText}>{item.achievementDate}</Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, item.verificationStatus === 'Verified' ? styles.verifiedBadge : styles.pendingBadge]}>
                      <Text style={[styles.statusBadgeText, item.verificationStatus === 'Verified' ? styles.verifiedText : styles.pendingText]}>
                        {item.verificationStatus || 'Pending'}
                      </Text>
                    </View>
                  </View>

                  {item.description ? (
                    <Text style={styles.achievementDescription} numberOfLines={2}>{item.description}</Text>
                  ) : null}

                  <View style={styles.cardFooter}>
                    {item.certificateUri ? (
                      <TouchableOpacity
                        style={styles.viewCertificate}
                        onPress={() => handleViewCertificate(item.certificateUri!)}
                      >
                        <Ionicons name="document-text-outline" size={16} color={COLORS.primary} />
                        <Text style={styles.viewCertificateText}>View Certificate</Text>
                      </TouchableOpacity>
                    ) : (
                      <View />
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
              <Text style={styles.modalTitle}>Achievement Certificate</Text>
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
    </SafeAreaView>
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
  achievementCard: {
    backgroundColor: COLORS.background,
    padding: 18,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  achievementTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text, marginBottom: 4 },
  achievementMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  typeTag: { backgroundColor: `${COLORS.primary}10`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  typeTagText: { fontSize: 11, color: COLORS.primary, fontWeight: 'bold' },
  metaText: { fontSize: 12, color: COLORS.textSecondary },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: COLORS.textLight },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: 'bold' },
  verifiedBadge: { backgroundColor: `${COLORS.success}15` },
  verifiedText: { color: COLORS.success },
  pendingBadge: { backgroundColor: `${COLORS.warning}15` },
  pendingText: { color: COLORS.warning },
  achievementDescription: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 16 },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  viewCertificate: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${COLORS.primary}10`, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  viewCertificateText: { color: COLORS.primary, fontSize: 13, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 600, maxHeight: '80%', backgroundColor: COLORS.white, borderRadius: 24, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  closeButton: { padding: 4 },
  imageContainer: { padding: 20, alignItems: 'center', justifyContent: 'center', minHeight: 300 },
  fullImage: { width: '100%', height: 400 }
});

