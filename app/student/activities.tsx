import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ActivitiesHub() {
  const router = useRouter();

  const activityModules = [
    {
      id: 'cocurricular',
      title: 'Co-Curricular Activities',
      description: 'Technical events, workshops, seminars, and paper presentations.',
      icon: '📚',
      color: '#2196F3',
      route: '/student/co-curricular'
    },
    {
      id: 'extracurricular',
      title: 'Extra-Curricular Activities',
      description: 'Sports, cultural events, NSS, and social activities.',
      icon: '🏆',
      color: '#FF9800',
      route: '/student/extra-curricular'
    },
    {
      id: 'courses',
      title: 'Online Courses & Certifications',
      description: 'NPTEL, Coursera, Udemy, and other certification courses.',
      icon: '🎓',
      color: '#4CAF50',
      route: '/student/courses'
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activities</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>Select a category to manage your activities</Text>

        {activityModules.map((module) => (
          <TouchableOpacity
            key={module.id}
            style={[styles.moduleCard, { borderLeftColor: module.color }]}
            onPress={() => router.push(module.route as any)}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.moduleIcon}>{module.icon}</Text>
            </View>
            <View style={styles.moduleInfo}>
              <Text style={styles.moduleTitle}>{module.title}</Text>
              <Text style={styles.moduleDescription}>{module.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#ccc" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  backButton: {
    padding: 8
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333'
  },
  scrollContent: {
    padding: 20
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15
  },
  moduleIcon: {
    fontSize: 30
  },
  moduleInfo: {
    flex: 1
  },
  moduleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4
  },
  moduleDescription: {
    fontSize: 14,
    color: '#777',
    lineHeight: 20
  }
});
