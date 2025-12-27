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
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StudentActivity,
  getStudentActivities,
  saveStudentActivity
} from '../../storage/sqlite';
import { uploadToCloudinary } from '../../services/cloudinaryservices';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function CoursesScreen() {
  const router = useRouter();
  const [prn, setPrn] = useState('');
  const [courses, setCourses] = useState<StudentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [certificateModalVisible, setCertificateModalVisible] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState('');

  // Form fields
  const [courseName, setCourseName] = useState('');
  const [platform, setPlatform] = useState('');
  const [duration, setDuration] = useState('');
  const [semester, setSemester] = useState('3');
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().split('T')[0]);
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
      const data = await getStudentActivities(userPrn);
      setCourses(data.filter(a => a.type === 'Courses'));
    } catch (error) {
      console.error('Error loading courses:', error);
      Alert.alert('Error', 'Failed to load courses');
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

  const saveNewCourse = async () => {
    if (!courseName.trim() || !platform.trim()) {
      Alert.alert('Error', 'Please enter course name and platform');
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
            'intership_gfm_record/courses_gfm_record'
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

      const course: StudentActivity = {
        prn,
        semester: parseInt(semester),
        activityName: `${courseName.trim()} (${platform.trim()}, ${duration.trim()})`,
        type: 'Courses',
        activityDate: completionDate,
        certificateUri: finalCertificateUri
      };

      await saveStudentActivity(course);
      Alert.alert('Success', 'Course added successfully!');
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving course:', error);
      Alert.alert('Error', 'Failed to save course');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setCourseName('');
    setPlatform('');
    setDuration('');
    setSemester('3');
    setCompletionDate(new Date().toISOString().split('T')[0]);
    setCertificateUri('');
  };

  if (loading && courses.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Online Courses</Text>
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
            <Text style={styles.label}>Course Name *</Text>
            <TextInput
              style={styles.input}
              value={courseName}
              onChangeText={setCourseName}
              placeholder="e.g., Python for Data Science"
            />

            <Text style={styles.label}>Platform *</Text>
            <TextInput
              style={styles.input}
              value={platform}
              onChangeText={setPlatform}
              placeholder="e.g., Coursera, NPTEL, Udemy"
            />

            <Text style={styles.label}>Duration</Text>
            <TextInput
              style={styles.input}
              value={duration}
              onChangeText={setDuration}
              placeholder="e.g., 8 weeks, 40 hours"
            />

            <Text style={styles.label}>Completion Date *</Text>
            <TextInput
              style={styles.input}
              value={completionDate}
              onChangeText={setCompletionDate}
              placeholder="YYYY-MM-DD"
            />

            <TouchableOpacity style={styles.uploadButton} onPress={pickCertificate}>
              <Ionicons name="cloud-upload-outline" size={24} color="#4CAF50" />
              <Text style={styles.uploadText}>
                {certificateUri ? 'Certificate Selected' : 'Upload Certificate'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitButton} onPress={saveNewCourse}>
              <Text style={styles.submitText}>Save Course</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.listContainer}>
          {courses.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎓</Text>
              <Text style={styles.emptyText}>No courses added yet</Text>
            </View>
          ) : (
            courses.map((item, index) => (
              <View key={index} style={styles.courseCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.courseName}>{item.courseName}</Text>
                    <Text style={styles.courseDetails}>{item.platform} • {item.duration}</Text>
                    <Text style={styles.completionDate}>Completed: {item.completionDate}</Text>
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
                    <Ionicons name="eye-outline" size={18} color="#4CAF50" />
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
    backgroundColor: '#4CAF50', 
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
  uploadButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 2, 
    borderColor: '#4CAF50', 
    borderStyle: 'dashed', 
    borderRadius: 8, 
    padding: 16, 
    marginTop: 20 
  },
  uploadText: { marginLeft: 10, color: '#4CAF50', fontWeight: 'bold' },
  submitButton: { 
    backgroundColor: '#4CAF50', 
    padding: 16, 
    borderRadius: 8, 
    alignItems: 'center', 
    marginTop: 20 
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  listContainer: { paddingBottom: 40 },
  courseCard: { 
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
  courseName: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  courseDetails: { fontSize: 13, color: '#666', marginTop: 2 },
  completionDate: { fontSize: 12, color: '#888', marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  verifiedBadge: { backgroundColor: '#E8F5E9' },
  pendingBadge: { backgroundColor: '#FFF3E0' },
  statusBadgeText: { fontSize: 11, fontWeight: 'bold' },
  viewCertificate: { flexDirection: 'row', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10 },
  viewCertificateText: { marginLeft: 6, color: '#4CAF50', fontWeight: '600' },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyEmoji: { fontSize: 60, marginBottom: 10 },
  emptyText: { color: '#999', fontSize: 16 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalClose: { position: 'absolute', top: 50, right: 20, zIndex: 1 },
  fullImage: { width: '100%', height: '80%' }
});
