import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Internship,
  getInternships,
  saveInternship,
  calculateDuration
} from '../../storage/sqlite';
import { uploadToCloudinary } from '../../services/cloudinaryservices';
import { Ionicons } from '@expo/vector-icons';

export default function InternshipsScreen() {
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
      const userPrn = await AsyncStorage.getItem('userPrn');
      if (!userPrn) return;

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
      
      console.log('File selected:', file.name, file.mimeType, file.size);

      if (file.size && file.size > 5 * 1024 * 1024) { // Increased to 5MB
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

    if (description.length > 1000) {
      Alert.alert('Error', 'Description must be less than 1000 characters');
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
            'intership_gfm_record'
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
        certificateUri: finalCertificateUri
      };

      await saveInternship(internship);
      
      Alert.alert('Success', 'Internship added successfully!');
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving internship:', error);
      Alert.alert('Error', 'Failed to save internship. Please check your connection.');
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F44336" />
        <Text style={styles.loadingText}>Loading internships...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Internships</Text>
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
              <Text style={styles.formTitle}>Add Internship</Text>

              {/* Semester */}
              <Text style={styles.label}>Semester *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={semester}
                  onValueChange={(val) => setSemester(val)}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                    <Picker.Item key={s} label={`Semester ${s}`} value={s.toString()} />
                  ))}
                </Picker>
              </View>

              {/* Company Name */}
              <Text style={styles.label}>Company Name *</Text>
            <TextInput
              style={styles.input}
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="e.g., Google, Microsoft, Amazon"
            />

            {/* Role/Position */}
            <Text style={styles.label}>Role / Position *</Text>
            <TextInput
              style={styles.input}
              value={role}
              onChangeText={setRole}
              placeholder="e.g., Software Development Intern"
            />

            {/* Internship Type */}
            <Text style={styles.label}>Internship Type *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={internshipType}
                onValueChange={(value) => setInternshipType(value as 'Paid' | 'Unpaid')}
                style={styles.picker}
              >
                <Picker.Item label="Paid" value="Paid" />
                <Picker.Item label="Unpaid" value="Unpaid" />
              </Picker>
            </View>

            {/* Start Date */}
            <Text style={styles.label}>Start Date *</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
            />

            {/* End Date */}
            <Text style={styles.label}>End Date *</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
            />

            {/* Duration (Auto-calculated) */}
            {duration > 0 && (
              <View style={styles.durationContainer}>
                <Ionicons name="time-outline" size={20} color="#F44336" />
                <Text style={styles.durationText}>
                  Duration: {duration} month{duration !== 1 ? 's' : ''}
                </Text>
              </View>
            )}

            {/* Stipend (Conditional) */}
            {internshipType === 'Paid' && (
              <>
                <Text style={styles.label}>Monthly Stipend (₹) *</Text>
                <TextInput
                  style={styles.input}
                  value={stipend}
                  onChangeText={setStipend}
                  keyboardType="numeric"
                  placeholder="Enter stipend amount"
                />
              </>
            )}

            {/* Description */}
            <Text style={styles.label}>Description (Optional, Max 1000 chars)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Brief description of your responsibilities and learnings"
              multiline
              numberOfLines={5}
              maxLength={1000}
            />
            <Text style={styles.charCount}>{description.length}/1000</Text>

            {/* Certificate Upload */}
            <Text style={styles.label}>Certificate (Optional)</Text>
            <TouchableOpacity style={styles.uploadButton} onPress={pickCertificate}>
              <Ionicons name="cloud-upload-outline" size={24} color="#F44336" />
              <Text style={styles.uploadText}>
                {certificateUri ? 'Certificate Uploaded ✓' : 'Upload Certificate'}
              </Text>
            </TouchableOpacity>

            {/* Submit Button */}
            <TouchableOpacity style={styles.submitButton} onPress={saveNewInternship}>
              <Text style={styles.submitText}>Add Internship</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Internships List */}
        <View style={styles.listCard}>
          <Text style={styles.listTitle}>My Internships</Text>

          {internships.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💼</Text>
              <Text style={styles.emptyText}>No internships added yet</Text>
            </View>
          ) : (
            internships.map((internship, index) => (
              <View key={index} style={styles.internshipCard}>
                  <View style={styles.internshipHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.companyName}>{internship.companyName}</Text>
                      <Text style={styles.role}>Sem {internship.semester} • {internship.role}</Text>
                    </View>
                    <View style={styles.badgeGroup}>
                      <View style={[styles.statusBadge, internship.verificationStatus === 'Verified' ? styles.verifiedBadge : styles.pendingBadge]}>
                        <Text style={[styles.statusBadgeText, internship.verificationStatus === 'Verified' ? styles.verifiedText : styles.pendingText]}>
                          {internship.verificationStatus || 'Pending'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.typeBadge,
                          internship.internshipType === 'Paid' 
                            ? styles.paidBadge 
                            : styles.unpaidBadge
                        ]}
                      >
                        <Text style={styles.typeBadgeText}>{internship.internshipType}</Text>
                      </View>
                    </View>
                  </View>

                <View style={styles.internshipDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color="#666" />
                    <Text style={styles.detailText}>
                      {internship.startDate} to {internship.endDate}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={16} color="#666" />
                    <Text style={styles.detailText}>
                      {internship.duration} month{internship.duration !== 1 ? 's' : ''}
                    </Text>
                  </View>

                  {internship.stipend && (
                    <View style={styles.detailRow}>
                      <Ionicons name="cash-outline" size={16} color="#4CAF50" />
                      <Text style={[styles.detailText, styles.stipendText]}>
                        ₹{internship.stipend.toLocaleString()}/month
                      </Text>
                    </View>
                  )}
                </View>

                {internship.description && (
                  <Text style={styles.internshipDescription}>
                    {internship.description}
                  </Text>
                )}

                {internship.certificateUri && (
                  <View style={styles.certificateBadge}>
                    <Ionicons name="ribbon-outline" size={16} color="#4CAF50" />
                    <Text style={styles.certificateText}>Certificate Available</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
    backgroundColor: '#F44336',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20
  },
  headerTitle: {
    fontSize: 24,
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
    height: 120,
    textAlignVertical: 'top'
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
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F44336'
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F44336',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    gap: 8
  },
  uploadText: {
    fontSize: 16,
    color: '#F44336',
    fontWeight: '600'
  },
  submitButton: {
    backgroundColor: '#F44336',
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
  internshipCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336'
  },
  internshipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4
  },
  role: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500'
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  paidBadge: {
    backgroundColor: '#C8E6C9'
  },
  unpaidBadge: {
    backgroundColor: '#FFE0B2'
  },
    typeBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#333'
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
  internshipDetails: {
    gap: 8,
    marginBottom: 12
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  detailText: {
    fontSize: 14,
    color: '#666'
  },
  stipendText: {
    color: '#4CAF50',
    fontWeight: '600'
  },
  internshipDescription: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0'
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
  }
});