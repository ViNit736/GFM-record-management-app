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
  Image,
  SafeAreaView
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Achievement,
  getAchievements,
  saveAchievement
} from '../../storage/sqlite';
import { uploadToCloudinary } from '../../services/cloudinaryservices';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function AchievementsScreen() {
  const router = useRouter();
  const [prn, setPrn] = useState('');
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [certificateModalVisible, setCertificateModalVisible] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState('');

  // Form fields
  const [achievementName, setAchievementName] = useState('');
  const [type, setType] = useState('Technical');
  const [semester, setSemester] = useState('3');
  const [achievementDate, setAchievementDate] = useState(new Date().toISOString().split('T')[0]);
  const [certificateUri, setCertificateUri] = useState('');
  const [certificateFileInfo, setCertificateFileInfo] = useState<{ name: string, type: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userPrn = await AsyncStorage.getItem('userPrn');
      if (!userPrn) return;

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
        setCertificateFileInfo({
          name: file.name || 'certificate.jpg',
          type: file.mimeType || 'image/jpeg'
        });
      }
    } catch (error) {
      console.error('Error picking certificate:', error);
      Alert.alert('Error', 'Failed to upload certificate');
    }
  };

  const saveNewAchievement = async () => {
    if (!achievementName.trim()) {
      Alert.alert('Error', 'Please enter achievement name');
      return;
    }

    setLoading(true);
      try {
        let finalCertificateUri = certificateUri;
        if (certificateUri && (certificateUri.startsWith('file://') || certificateUri.startsWith('blob:') || certificateUri.startsWith('data:'))) {
          const uploadedUrl = await uploadToCloudinary(
            certificateUri,
            certificateFileInfo?.type || 'image/jpeg',
            certificateFileInfo?.name || 'certificate.jpg',
            'archivements_gfm_record'
          );
          
          if (uploadedUrl) {
            finalCertificateUri = uploadedUrl;
          } else {
            Alert.alert('Upload Failed', 'Failed to upload certificate to cloud. Please try again.');
            setLoading(false);
            return;
          }
        }

        const achievement: Achievement = {
        prn,
        achievementName: achievementName.trim(),
        semester: parseInt(semester),
        type,
        achievementDate,
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
    setType('Technical');
    setSemester('3');
    setAchievementDate(new Date().toISOString().split('T')[0]);
    setCertificateUri('');
  };

  if (loading && achievements.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9C27B0" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Achievements</Text>
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
            <Text style={styles.label}>Achievement Name *</Text>
            <TextInput
              style={styles.input}
              value={achievementName}
              onChangeText={setAchievementName}
                placeholder="e.g., Technical Paper Presentation, Sports Award"
              />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Semester *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={semester}
                    onValueChange={(val) => setSemester(val)}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                      <Picker.Item key={s} label={`Sem ${s}`} value={s.toString()} />
                    ))}
                  </Picker>
                </View>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.label}>Type *</Text>
                  <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={type}
                        onValueChange={(val) => setType(val)}
                      >
                        <Picker.Item label="Technical" value="Technical" />
                        <Picker.Item label="Non-Technical" value="Non-Technical" />
                      </Picker>
                  </View>

              </View>
            </View>

            <Text style={styles.label}>Date *</Text>
            <TextInput
              style={styles.input}
              value={achievementDate}
              onChangeText={setAchievementDate}
              placeholder="YYYY-MM-DD"
            />

            <TouchableOpacity style={styles.uploadButton} onPress={pickCertificate}>
              <Ionicons name="cloud-upload-outline" size={24} color="#9C27B0" />
              <Text style={styles.uploadText}>
                {certificateUri ? 'Certificate Selected' : 'Upload Certificate'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitButton} onPress={saveNewAchievement}>
              <Text style={styles.submitText}>Save Achievement</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.listContainer}>
          {achievements.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎖️</Text>
              <Text style={styles.emptyText}>No achievements added yet</Text>
            </View>
          ) : (
            achievements.map((item, index) => (
              <View key={index} style={styles.achievementCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.achievementTitle}>{item.achievementName}</Text>
                    <Text style={styles.achievementCategory}>Sem {item.semester} • {item.type} • {item.achievementDate}</Text>
                  </View>
                  <View style={[styles.statusBadge, item.verificationStatus === 'Verified' ? styles.verifiedBadge : styles.pendingBadge]}>
                    <Text style={styles.statusBadgeText}>{item.verificationStatus || 'Pending'}</Text>
                  </View>
                </View>
                {item.certificateUri && (
                  <TouchableOpacity 
                    style={styles.viewCertificate}
                    onPress={() => {
                      setSelectedCertificate(item.certificateUri!);
                      setCertificateModalVisible(true);
                    }}
                  >
                    <Ionicons name="eye-outline" size={18} color="#9C27B0" />
                    <Text style={styles.viewCertificateText}>View Certificate</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={certificateModalVisible} transparent={true}>
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
    backgroundColor: '#9C27B0', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingTop: 50, 
    paddingBottom: 20, 
    paddingHorizontal: 20 
  },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  addButton: { padding: 5 },
  content: { flex: 1, padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  textArea: { height: 100, textAlignVertical: 'top' },
  pickerContainer: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden' },
  uploadButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 2, 
    borderColor: '#9C27B0', 
    borderStyle: 'dashed', 
    borderRadius: 8, 
    padding: 16, 
    marginTop: 20 
  },
  uploadText: { marginLeft: 10, color: '#9C27B0', fontWeight: 'bold' },
  submitButton: { 
    backgroundColor: '#9C27B0', 
    padding: 16, 
    borderRadius: 8, 
    alignItems: 'center', 
    marginTop: 20 
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  listContainer: { paddingBottom: 40 },
  achievementCard: { 
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
  achievementTitle: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  achievementCategory: { fontSize: 13, color: '#666', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  verifiedBadge: { backgroundColor: '#E8F5E9' },
  pendingBadge: { backgroundColor: '#FFF3E0' },
  statusBadgeText: { fontSize: 11, fontWeight: 'bold' },
  description: { fontSize: 14, color: '#555', marginTop: 10, lineHeight: 20 },
  viewCertificate: { flexDirection: 'row', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10 },
  viewCertificateText: { marginLeft: 6, color: '#9C27B0', fontWeight: '600' },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyEmoji: { fontSize: 60, marginBottom: 10 },
  emptyText: { color: '#999', fontSize: 16 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalClose: { position: 'absolute', top: 50, right: 20, zIndex: 1 },
  fullImage: { width: '100%', height: '80%' }
});
