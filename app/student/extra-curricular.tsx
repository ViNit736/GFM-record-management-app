import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Image
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StudentActivity,
  getStudentActivities,
  saveStudentActivity,
  getAcademicYearFromSemester
} from '../../storage/sqlite';
import { uploadToCloudinary } from '../../services/cloudinaryservices';
import { Ionicons } from '@expo/vector-icons';

export default function NonTechnicalActivitiesScreen() {
  const [prn, setPrn] = useState('');
  const [activities, setActivities] = useState<StudentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [certificateModalVisible, setCertificateModalVisible] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState('');

  // Form fields
  const [semester, setSemester] = useState(1);
  const [activityName, setActivityName] = useState('');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [certificateUri, setCertificateUri] = useState('');
  const [certificatePreview, setCertificatePreview] = useState('');
  const [certificateFileInfo, setCertificateFileInfo] = useState<{ name: string, type: string } | null>(null);

  const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userPrn = await AsyncStorage.getItem('userPrn');
      if (!userPrn) return;

      setPrn(userPrn);
      const data = await getStudentActivities(userPrn);
      setActivities(data.filter(a => a.type === 'Extra-curricular'));
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
      
      if (file.size && file.size > 1024 * 1024) {
        Alert.alert('Error', 'File size must be less than 1MB');
        return;
      }

      setCertificateUri(file.uri);
      setCertificatePreview(file.uri);
      setCertificateFileInfo({
        name: file.name || 'certificate.jpg',
        type: file.mimeType || 'image/jpeg'
      });
      Alert.alert('Success', 'Certificate selected successfully');
    }

    } catch (error) {
      console.error('Error picking certificate:', error);
      Alert.alert('Error', 'Failed to upload certificate');
    }
  };

  const viewCertificate = (uri: string) => {
    setSelectedCertificate(uri);
    setCertificateModalVisible(true);
  };

  const validateForm = (): boolean => {
    if (!activityName.trim()) {
      Alert.alert('Error', 'Please enter activity name');
      return false;
    }

    if (description.length > 500) {
      Alert.alert('Error', 'Description must be less than 500 characters');
      return false;
    }

    return true;
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
            'intership_gfm_record/extracurricular_gfm_record'
          );
          
          if (uploadedUrl) {
            finalCertificateUri = uploadedUrl;
          } else {
            // If upload failed, we shouldn't save with a local URI that might not persist or is too large
            Alert.alert('Upload Failed', 'Failed to upload certificate to cloud. Please try again.');
            setLoading(false);
            return;
          }
        }

        const activity: StudentActivity = {
          prn,
          semester,
          activityName: activityName.trim(),
          type: 'Extra-curricular',
          activityDate,
          certificateUri: finalCertificateUri
        };

        await saveStudentActivity(activity);
        
        Alert.alert('Success', 'Extra-curricular activity added successfully!');

      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving activity:', error);
      Alert.alert('Error', 'Failed to save activity. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setSemester(1);
    setActivityName('');
    setActivityDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setCertificateUri('');
    setCertificatePreview('');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF9800" />
        <Text style={styles.loadingText}>Loading activities...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Non-Technical Activities</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowForm(!showForm)}
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Form */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Add Non-Technical Activity</Text>
            <Text style={styles.formSubtitle}>
              Sports, Cultural Events, NSS/NCC, Social Work, Clubs, etc.
            </Text>

            {/* Semester */}
            <Text style={styles.label}>Semester *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={semester}
                onValueChange={setSemester}
                style={styles.picker}
              >
                {semesters.map(sem => (
                  <Picker.Item key={sem} label={`Semester ${sem}`} value={sem} />
                ))}
              </Picker>
            </View>
            <Text style={styles.helperText}>
              Academic Year: {getAcademicYearFromSemester(semester)}
            </Text>

            {/* Activity Name */}
            <Text style={styles.label}>Activity Name *</Text>
            <TextInput
              style={styles.input}
              value={activityName}
              onChangeText={setActivityName}
              placeholder="e.g., Annual Sports Day, Cultural Fest, Blood Donation"
            />

            {/* Activity Date */}
            <Text style={styles.label}>Activity Date *</Text>
            <TextInput
              style={styles.input}
              value={activityDate}
              onChangeText={setActivityDate}
              placeholder="YYYY-MM-DD"
            />

            {/* Description */}
            <Text style={styles.label}>Description (Max 500 chars)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Brief description of the non-technical activity"
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.charCount}>{description.length}/500</Text>

            {/* Certificate Upload */}
            <Text style={styles.label}>Certificate (Max 1MB)</Text>
            <TouchableOpacity style={styles.uploadButton} onPress={pickCertificate}>
              <Ionicons name="cloud-upload-outline" size={24} color="#FF9800" />
              <Text style={styles.uploadText}>
                {certificateUri ? 'Certificate Uploaded ✓' : 'Upload Certificate'}
              </Text>
            </TouchableOpacity>

            {/* Certificate Preview */}
            {certificatePreview && !certificatePreview.endsWith('.pdf') && (
              <TouchableOpacity onPress={() => viewCertificate(certificatePreview)}>
                <Image
                  source={{ uri: certificatePreview }}
                  style={styles.certificatePreview}
                  resizeMode="cover"
                />
                <Text style={styles.previewText}>Tap to view full size</Text>
              </TouchableOpacity>
            )}

            {certificatePreview && certificatePreview.endsWith('.pdf') && (
              <View style={styles.pdfPreview}>
                <Ionicons name="document-text" size={40} color="#FF9800" />
                <Text style={styles.pdfText}>PDF Certificate Uploaded</Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity style={styles.submitButton} onPress={saveActivity}>
              <Text style={styles.submitText}>Add Activity</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Activities List */}
        <View style={styles.listCard}>
          <Text style={styles.listTitle}>Non-Technical Activities ({activities.length})</Text>

          {activities.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎨</Text>
              <Text style={styles.emptyText}>No non-technical activities added yet</Text>
            </View>
          ) : (
            activities.map((activity, index) => (
              <View key={index} style={styles.activityCard}>
                <View style={styles.activityHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityName}>{activity.activityName}</Text>
                      <Text style={styles.activitySemester}>
                        Semester {activity.semester} • {activity.academicYear}
                      </Text>
                    </View>
                    <View style={styles.badgeGroup}>
                      <View style={[styles.statusBadge, activity.verificationStatus === 'Verified' ? styles.verifiedBadge : styles.pendingBadge]}>
                        <Text style={[styles.statusBadgeText, activity.verificationStatus === 'Verified' ? styles.verifiedText : styles.pendingText]}>
                          {activity.verificationStatus || 'Pending'}
                        </Text>
                      </View>
                      <View style={styles.nonTechnicalBadge}>
                        <Ionicons name="color-palette" size={16} color="#FF9800" />
                        <Text style={styles.nonTechnicalBadgeText}>Non-Technical</Text>
                      </View>
                    </View>
                  </View>

                <View style={styles.activityRow}>
                  <Ionicons name="calendar-outline" size={16} color="#666" />
                  <Text style={styles.activityDate}>{activity.activityDate}</Text>
                </View>

                {activity.description && (
                  <Text style={styles.activityDescription}>{activity.description}</Text>
                )}

                {activity.certificateUri && (
                  <TouchableOpacity
                    style={styles.certificateBadge}
                    onPress={() => viewCertificate(activity.certificateUri!)}
                  >
                    <Ionicons name="ribbon-outline" size={16} color="#4CAF50" />
                    <Text style={styles.certificateText}>View Certificate</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Certificate Modal */}
      <Modal
        visible={certificateModalVisible}
        transparent={true}
        onRequestClose={() => setCertificateModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setCertificateModalVisible(false)}
            >
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            
            {selectedCertificate.endsWith('.pdf') ? (
              <View style={styles.pdfModalView}>
                <Ionicons name="document-text" size={80} color="#FF9800" />
                <Text style={styles.pdfModalText}>PDF Certificate</Text>
                <Text style={styles.pdfModalSubtext}>
                  Open in external app to view
                </Text>
              </View>
            ) : (
              <Image
                source={{ uri: selectedCertificate }}
                style={styles.certificateImage}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666'
  },
  header: {
    backgroundColor: '#FF9800',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff'
  },
  addButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    padding: 10,
    borderRadius: 50
  },
  content: {
    flex: 1,
    padding: 16
  },
  formCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4
  },
  formSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    marginTop: 12
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff'
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top'
  },
  helperText: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 4,
    fontStyle: 'italic'
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden'
  },
  picker: {
    height: 50
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FF9800',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    gap: 8
  },
  uploadText: {
    fontSize: 16,
    color: '#FF9800',
    fontWeight: '600'
  },
  certificatePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 12
  },
  previewText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#FF9800',
    marginTop: 8
  },
  pdfPreview: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    marginTop: 12
  },
  pdfText: {
    fontSize: 14,
    color: '#FF9800',
    marginTop: 8,
    fontWeight: '600'
  },
  submitButton: {
    backgroundColor: '#FF9800',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  listCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  listTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 12
  },
  emptyText: {
    fontSize: 16,
    color: '#999'
  },
  activityCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800'
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  activityName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4
  },
  activitySemester: {
    fontSize: 13,
    color: '#666'
  },
    nonTechnicalBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: '#FFF3E0'
    },
    badgeGroup: {
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 6
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    verifiedBadge: {
      backgroundColor: '#E8F5E9',
    },
    pendingBadge: {
      backgroundColor: '#FFF3E0',
    },
    statusBadgeText: {
      fontSize: 10,
      fontWeight: 'bold',
      textTransform: 'uppercase'
    },
    verifiedText: {
      color: '#4CAF50',
    },
    pendingText: {
      color: '#FF9800',
    },
  nonTechnicalBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9800'
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8
  },
  activityDate: {
    fontSize: 14,
    color: '#666'
  },
  activityDescription: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginTop: 8
  },
  certificateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0'
  },
  certificateText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '600'
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    width: '90%',
    height: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginBottom: 12
  },
  certificateImage: {
    width: '100%',
    height: '100%'
  },
  pdfModalView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  pdfModalText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16
  },
  pdfModalSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8
  }
});