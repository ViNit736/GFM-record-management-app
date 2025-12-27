import React, { useEffect, useState } from 'react';
import { 
  getAcademicRecordsByStudent, 
  AcademicRecord, 
  getStudentInfo 
} from '../../storage/sqlite';
import { getSession } from '../../services/session.service';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';

export default function AcademicRecordsScreen() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const loadRecords = async () => {
    try {
      const session = await getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      const data = await getAcademicRecordsByStudent(session.prn);
      setRecords(data);
    } catch (error) {
      console.error('Error loading academic records:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadRecords();
  };

  const groupedRecords = records.reduce((acc: any, record) => {
    const sem = `Semester ${record.semester}`;
    if (!acc[sem]) acc[sem] = [];
    acc[sem].push(record);
    return acc;
  }, {});

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF9800" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Academic Records</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {Object.keys(groupedRecords).length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>No academic records found</Text>
          </View>
        ) : (
          Object.keys(groupedRecords).map((sem) => (
            <View key={sem} style={styles.semesterSection}>
              <View style={styles.semesterHeader}>
                <Text style={styles.semesterTitle}>{sem}</Text>
              </View>
              {groupedRecords[sem].map((record: any, index: number) => (
                <View key={index} style={styles.recordCard}>
                  <View style={styles.recordMain}>
                    <View>
                      <Text style={styles.courseName}>{record.courseName}</Text>
                      <Text style={styles.courseCode}>{record.courseCode} • {record.credits} Credits</Text>
                    </View>
                    <View style={styles.gradeBadge}>
                      <Text style={styles.gradeText}>{record.grade || 'N/A'}</Text>
                    </View>
                  </View>

                  <View style={styles.marksGrid}>
                    <MarkItem label="ISE" score={record.iseMarks} max={record.iseMax || 20} />
                    <MarkItem label="MSE" score={record.mseMarks} max={record.mseMax || 30} />
                    <MarkItem label="ESE" score={record.eseMarks} max={record.eseMax || 50} />
                    <MarkItem label="Total" score={record.totalMarks} max={100} isTotal />
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const MarkItem = ({ label, score, max, isTotal = false }: any) => (
  <View style={styles.markItem}>
    <Text style={styles.markLabel}>{label}</Text>
    <Text style={[styles.markScore, isTotal && styles.totalScore]}>
      {score ?? '-'}<Text style={styles.markMax}>/{max}</Text>
    </Text>
  </View>
);

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
  header: {
    backgroundColor: '#FF9800',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backButton: {
    padding: 8
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff'
  },
  content: {
    flex: 1,
    padding: 16
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16
  },
  emptyText: {
    fontSize: 16,
    color: '#666'
  },
  semesterSection: {
    marginBottom: 24
  },
  semesterHeader: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FF9800',
    paddingBottom: 4
  },
  semesterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF9800'
  },
  recordCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  recordMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  courseName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2
  },
  courseCode: {
    fontSize: 12,
    color: '#777'
  },
  gradeBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE0B2'
  },
  gradeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9800'
  },
  marksGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fafafa',
    padding: 12,
    borderRadius: 8
  },
  markItem: {
    alignItems: 'center'
  },
  markLabel: {
    fontSize: 10,
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 4
  },
  markScore: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333'
  },
  totalScore: {
    color: '#FF9800',
    fontSize: 16
  },
  markMax: {
    fontSize: 10,
    color: '#bbb',
    fontWeight: 'normal'
  }
});