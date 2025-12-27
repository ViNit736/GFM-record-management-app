import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Alert,
  Modal,
  TextInput,
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getFacultyMembers, saveFacultyMember, deleteFacultyMember, FacultyMember } from '../../storage/sqlite';
import { getSession } from '../../services/session.service';
import { COLORS } from '../../constants/colors';

const { width } = Dimensions.get('window');

export default function ManageFaculty() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [faculty, setFaculty] = useState<FacultyMember[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newPrn, setNewPrn] = useState('');
  const [newPassword, setNewPassword] = useState('password123');

  useEffect(() => {
    checkAuth();
    loadFaculty();
  }, []);

  const checkAuth = async () => {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      router.replace('/login');
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
    if (!newPrn || !newPassword) {
      Alert.alert('Error', 'Please enter PRN and Password');
      return;
    }
    try {
      await saveFacultyMember(newPrn, newPassword);
      setModalVisible(false);
      setNewPrn('');
      loadFaculty();
      Alert.alert('Success', 'Faculty member added successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to add faculty member');
    }
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
          <Text style={styles.facultyPrn}>{item.prn}</Text>
          <Text style={styles.facultyRole}>Faculty / Teacher</Text>
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
        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtn}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={faculty}
          keyExtractor={(item) => item.prn}
          renderItem={renderFacultyItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No faculty members found.</Text>
          }
        />
      )}

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Faculty Member</Text>
            <TextInput
              style={styles.input}
              placeholder="PRN / Username"
              value={newPrn}
              onChangeText={setNewPrn}
              autoCapitalize="characters"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
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
  },
  textContainer: {
    marginLeft: 15,
  },
  facultyPrn: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  facultyRole: {
    fontSize: 12,
    color: COLORS.textLight,
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
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
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
});
